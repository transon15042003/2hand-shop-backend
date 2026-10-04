import { db } from '../configs/database.js';
import { cashFlowEntries } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export class CashFlowRepository {
  async getRecentEntries(limit = 50) {
    return await db.query.cashFlowEntries.findMany({
      orderBy: [desc(cashFlowEntries.createdAt)],
      limit,
    });
  }

  async createEntry(data: typeof cashFlowEntries.$inferInsert) {
    const [created] = await db.insert(cashFlowEntries).values(data).returning();
    return created;
  }
}

export const cashFlowRepository = new CashFlowRepository();
