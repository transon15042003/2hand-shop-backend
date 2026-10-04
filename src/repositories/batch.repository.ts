import { db } from '../configs/database.js';
import { batches, items } from '../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';

export class BatchRepository {
  async findAll() {
    return await db.query.batches.findMany({
      orderBy: [desc(batches.importDate)],
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
}

export const batchRepository = new BatchRepository();
