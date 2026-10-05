import { db } from '../configs/database.js';
import { orders, orderItems, items } from '../db/schema.js';
import { eq, and, desc, inArray } from 'drizzle-orm';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import * as schema from '../db/schema.js';

type Tx = PgTransaction<NodePgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

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

  async hasCompletedOrderBefore(phone: string, tx: Tx | typeof db = db): Promise<boolean> {
    const completed = await tx.query.orders.findFirst({
      where: and(eq(orders.customerPhone, phone), eq(orders.orderStatus, 'completed')),
      columns: { orderCode: true },
    });
    return !!completed;
  }

  async hasCompletedOrderByCustomerId(customerId: string, tx: Tx | typeof db = db): Promise<boolean> {
    const completed = await tx.query.orders.findFirst({
      where: and(eq(orders.customerId, customerId), eq(orders.orderStatus, 'completed')),
      columns: { orderCode: true },
    });
    return !!completed;
  }

  /** Orders that currently reserve any of these items (status reserved). */
  async findActiveOrdersReservingItems(itemIds: string[], tx: Tx) {
    if (!itemIds.length) return [];
    const rows = await tx
      .select({ orderCode: orderItems.orderCode })
      .from(orderItems)
      .innerJoin(orders, eq(orders.orderCode, orderItems.orderCode))
      .where(and(inArray(orderItems.itemId, itemIds), eq(orders.orderStatus, 'new')));
    return [...new Set(rows.map((r) => r.orderCode))];
  }
}

export const orderRepository = new OrderRepository();
