import { db } from '../configs/database.js';
import { items } from '../db/schema.js';
import { eq, and, sql, desc, asc } from 'drizzle-orm';

export class ItemRepository {
  async findById(id: string) {
    return await db.query.items.findFirst({
      where: eq(items.id, id),
    });
  }

  async findAvailableItems(filters?: {
    category?: string;
    condition?: string;
    limit?: number;
    offset?: number;
    sort?: string;
  }) {
    const limit = filters?.limit ?? 20;
    const offset = filters?.offset ?? 0;

    const conditions = [eq(items.status, 'shelf')];
    if (filters?.category) {
      conditions.push(eq(items.category, filters.category as any));
    }
    if (filters?.condition) {
      conditions.push(eq(items.condition, filters.condition as any));
    }

    const whereClause = and(...conditions);

    let orderBy = desc(items.createdAt);
    if (filters?.sort === 'oldest') orderBy = asc(items.createdAt);
    if (filters?.sort === 'price_asc') orderBy = asc(items.price);
    if (filters?.sort === 'price_desc') orderBy = desc(items.price);

    const [itemList, countRes] = await Promise.all([
      db
        .select()
        .from(items)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(items)
        .where(whereClause),
    ]);

    return {
      items: itemList,
      total: Number(countRes[0]?.count ?? 0),
    };
  }

  async create(data: typeof items.$inferInsert) {
    const [created] = await db.insert(items).values(data).returning();
    return created;
  }

  async update(id: string, data: Partial<typeof items.$inferInsert>) {
    const [updated] = await db
      .update(items)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(items.id, id))
      .returning();
    return updated;
  }

  async countShelfItems() {
    const res = await db
      .select({ count: sql<number>`count(*)` })
      .from(items)
      .where(eq(items.status, 'shelf'));
    return Number(res[0]?.count ?? 0);
  }
}

export const itemRepository = new ItemRepository();
