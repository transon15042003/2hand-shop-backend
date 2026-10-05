import { eq, and, ne, sql, asc } from 'drizzle-orm';
import { db } from '../configs/database.js';
import { adminUsers, type AdminPermission } from '../db/schema.js';

export type AdminUserRow = typeof adminUsers.$inferSelect;

export const adminUserRepository = {
  async findById(id: string) {
    return db.query.adminUsers.findFirst({
      where: eq(adminUsers.id, id),
    });
  },

  async findByUsername(username: string) {
    return db.query.adminUsers.findFirst({
      where: eq(adminUsers.username, username),
    });
  },

  async list() {
    return db.select().from(adminUsers).orderBy(asc(adminUsers.createdAt));
  },

  async create(data: typeof adminUsers.$inferInsert) {
    const [created] = await db.insert(adminUsers).values(data).returning();
    return created;
  },

  async update(id: string, data: Partial<typeof adminUsers.$inferInsert>) {
    const [updated] = await db
      .update(adminUsers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(adminUsers.id, id))
      .returning();
    return updated;
  },

  async countActiveOwners(excludeId?: string) {
    const conditions = [eq(adminUsers.role, 'owner'), eq(adminUsers.isActive, true)];
    if (excludeId) conditions.push(ne(adminUsers.id, excludeId));
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminUsers)
      .where(and(...conditions));
    return rows[0]?.count ?? 0;
  },
};

export type { AdminPermission };
