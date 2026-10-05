import { db } from '../configs/database.js';
import { batches, items, orderItems, orders } from '../db/schema.js';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { BatchStats } from '../utils/batch-mapper.util.js';

export class BatchRepository {
  async findAll() {
    return await db.query.batches.findMany({
      orderBy: [desc(batches.importDate), desc(batches.createdAt)],
    });
  }

  async findById(id: string) {
    return await db.query.batches.findFirst({
      where: eq(batches.id, id),
    });
  }

  async findByCode(code: string) {
    return await db.query.batches.findFirst({
      where: eq(batches.code, code),
    });
  }

  async findByIdOrCode(ref: string) {
    const byId = await this.findById(ref);
    if (byId) return byId;
    return await this.findByCode(ref);
  }

  async create(data: typeof batches.$inferInsert) {
    const [created] = await db.insert(batches).values(data).returning();
    return created;
  }

  async update(id: string, data: Partial<typeof batches.$inferInsert>) {
    const [updated] = await db
      .update(batches)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(batches.id, id))
      .returning();
    return updated;
  }

  async statsForBatches(batchIds: string[]): Promise<Map<string, BatchStats>> {
    const map = new Map<string, BatchStats>();
    for (const id of batchIds) {
      map.set(id, { totalItemsCount: 0, soldItemsCount: 0, totalRevenue: 0 });
    }
    if (!batchIds.length) return map;

    const counts = await db
      .select({
        batchId: items.batchId,
        total: sql<number>`count(*)`,
        sold: sql<number>`count(*) filter (where ${items.status} = 'sold')`,
      })
      .from(items)
      .where(inArray(items.batchId, batchIds))
      .groupBy(items.batchId);

    for (const row of counts) {
      if (!row.batchId) continue;
      const cur = map.get(row.batchId) ?? { totalItemsCount: 0, soldItemsCount: 0, totalRevenue: 0 };
      cur.totalItemsCount = Number(row.total);
      cur.soldItemsCount = Number(row.sold);
      map.set(row.batchId, cur);
    }

    const revenue = await db
      .select({
        batchId: items.batchId,
        revenue: sql<number>`coalesce(sum(${orderItems.priceSnapshot}), 0)`,
      })
      .from(orderItems)
      .innerJoin(items, eq(items.id, orderItems.itemId))
      .innerJoin(orders, eq(orders.orderCode, orderItems.orderCode))
      .where(and(inArray(items.batchId, batchIds), eq(orders.orderStatus, 'completed')))
      .groupBy(items.batchId);

    for (const row of revenue) {
      if (!row.batchId) continue;
      const cur = map.get(row.batchId) ?? { totalItemsCount: 0, soldItemsCount: 0, totalRevenue: 0 };
      cur.totalRevenue = Number(row.revenue);
      map.set(row.batchId, cur);
    }

    return map;
  }

  async itemsForBatch(batchId: string) {
    return await db.query.items.findMany({
      where: eq(items.batchId, batchId),
      orderBy: [desc(items.createdAt)],
    });
  }
}

export const batchRepository = new BatchRepository();
