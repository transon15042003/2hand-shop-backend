import { db } from '../configs/database.js';
import { items } from '../db/schema.js';
import { eq, and, sql, desc, asc, gte, lte, or, ilike, count } from 'drizzle-orm';

export class ItemRepository {
  async findById(id: string) {
    return await db.query.items.findFirst({
      where: eq(items.id, id),
    });
  }

  async findPublicItems(filters?: {
    category?: string;
    condition?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
    limit?: number;
    offset?: number;
    sort?: string;
  }) {
    const limit = filters?.limit ?? 12;
    const offset = filters?.offset ?? 0;

    const conditions = [eq(items.status, 'shelf')];
    if (filters?.category) conditions.push(eq(items.category, filters.category as any));
    if (filters?.condition) conditions.push(eq(items.condition, filters.condition as any));
    if (filters?.minPrice !== undefined) conditions.push(gte(items.price, filters.minPrice));
    if (filters?.maxPrice !== undefined) conditions.push(lte(items.price, filters.maxPrice));
    if (filters?.search?.trim()) {
      const q = `%${filters.search.trim()}%`;
      conditions.push(or(ilike(items.name, q), ilike(items.id, q))!);
    }

    const whereClause = and(...conditions);
    let orderBy = desc(items.createdAt);
    if (filters?.sort === 'price_asc') orderBy = asc(items.price);
    if (filters?.sort === 'price_desc') orderBy = desc(items.price);

    const [itemList, countRes] = await Promise.all([
      db.select().from(items).where(whereClause).orderBy(orderBy).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(items).where(whereClause),
    ]);

    return { items: itemList, total: Number(countRes[0]?.count ?? 0) };
  }

  async findAdminItems(filters?: {
    status?: string;
    category?: string;
    condition?: string;
    batchId?: string;
    search?: string;
    limit?: number;
    offset?: number;
    sort?: string;
  }) {
    const limit = filters?.limit ?? 20;
    const offset = filters?.offset ?? 0;
    const conditions = [];
    if (filters?.status) conditions.push(eq(items.status, filters.status as any));
    if (filters?.category) conditions.push(eq(items.category, filters.category as any));
    if (filters?.condition) conditions.push(eq(items.condition, filters.condition as any));
    if (filters?.batchId) conditions.push(eq(items.batchId, filters.batchId));
    if (filters?.search?.trim()) {
      const q = `%${filters.search.trim()}%`;
      conditions.push(or(ilike(items.name, q), ilike(items.id, q))!);
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;

    let orderBy = desc(items.createdAt);
    if (filters?.sort === 'oldest') orderBy = asc(items.createdAt);
    if (filters?.sort === 'price_asc') orderBy = asc(items.price);
    if (filters?.sort === 'price_desc') orderBy = desc(items.price);
    if (filters?.sort === 'name_asc') orderBy = asc(items.name);
    if (filters?.sort === 'name_desc') orderBy = desc(items.name);

    const [itemList, countRes] = await Promise.all([
      db.select().from(items).where(whereClause).orderBy(orderBy).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(items).where(whereClause),
    ]);

    return { items: itemList, total: Number(countRes[0]?.count ?? 0) };
  }

  async statusStats() {
    const rows = await db
      .select({ status: items.status, count: count() })
      .from(items)
      .groupBy(items.status);
    const map = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
    const draft = map.draft ?? 0;
    const on_shelf = map.shelf ?? 0;
    const reserved = map.reserved ?? 0;
    const sold = map.sold ?? 0;
    return {
      total_items: draft + on_shelf + reserved + sold,
      on_shelf,
      reserved,
      sold,
      draft,
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
}

export const itemRepository = new ItemRepository();
