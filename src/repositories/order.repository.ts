import { db } from '../configs/database.js';
import { orders, orderItems, items } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';

export class OrderRepository {
  async findByCode(orderCode: string) {
    return await db.query.orders.findFirst({
      where: eq(orders.orderCode, orderCode),
    });
  }

  async findByCodeAndPhone(orderCode: string, phone: string) {
    return await db.query.orders.findFirst({
      where: and(eq(orders.orderCode, orderCode), eq(orders.customerPhone, phone)),
    });
  }

  async findOrderItems(orderCode: string) {
    return await db
      .select({
        item: items,
        priceSnapshot: orderItems.priceSnapshot,
      })
      .from(orderItems)
      .innerJoin(items, eq(orderItems.itemId, items.id))
      .where(eq(orderItems.orderCode, orderCode));
  }

  async findCustomerOrders(customerId: string) {
    return await db.query.orders.findMany({
      where: eq(orders.customerId, customerId),
      orderBy: [desc(orders.createdAt)],
    });
  }

  async hasCompletedOrderBefore(phone: string): Promise<boolean> {
    const completed = await db.query.orders.findFirst({
      where: and(eq(orders.customerPhone, phone), eq(orders.orderStatus, 'completed')),
    });
    return !!completed;
  }

  async create(data: typeof orders.$inferInsert) {
    const [created] = await db.insert(orders).values(data).returning();
    return created;
  }

  async addOrderItems(itemsData: (typeof orderItems.$inferInsert)[]) {
    return await db.insert(orderItems).values(itemsData).returning();
  }

  async update(orderCode: string, data: Partial<typeof orders.$inferInsert>) {
    const [updated] = await db
      .update(orders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(orders.orderCode, orderCode))
      .returning();
    return updated;
  }
}

export const orderRepository = new OrderRepository();
