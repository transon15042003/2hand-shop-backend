import { db } from '../configs/database.js';
import { customers, customerSessions, orders } from '../db/schema.js';
import { eq, or, and, gt, ne } from 'drizzle-orm';
import { HashUtil } from '../utils/hash.util.js';
import { SESSION_DURATION_DAYS } from '../constants/http-status.js';

export class CustomerRepository {
  async findById(id: string) {
    return await db.query.customers.findFirst({
      where: eq(customers.id, id),
    });
  }

  async findByPhone(phone: string) {
    return await db.query.customers.findFirst({
      where: eq(customers.phone, phone),
    });
  }

  async findByEmail(email: string) {
    return await db.query.customers.findFirst({
      where: eq(customers.email, email),
    });
  }

  async findByIdentifier(identifier: string) {
    return await db.query.customers.findFirst({
      where: or(eq(customers.email, identifier), eq(customers.phone, identifier)),
    });
  }

  async create(data: typeof customers.$inferInsert) {
    const [created] = await db.insert(customers).values(data).returning();
    return created;
  }

  async update(id: string, data: Partial<typeof customers.$inferInsert>) {
    const [updated] = await db
      .update(customers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return updated;
  }

  async createSession(customerId: string): Promise<string> {
    const rawToken = HashUtil.generateToken(32);
    const tokenHash = HashUtil.hashToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

    await db.insert(customerSessions).values({
      tokenHash,
      customerId,
      expiresAt,
    });

    return rawToken;
  }

  async findValidSession(tokenHash: string) {
    return await db.query.customerSessions.findFirst({
      where: and(eq(customerSessions.tokenHash, tokenHash), gt(customerSessions.expiresAt, new Date())),
    });
  }

  async touchSession(tokenHash: string, expiresAt: Date) {
    await db
      .update(customerSessions)
      .set({ lastSeenAt: new Date(), expiresAt })
      .where(eq(customerSessions.tokenHash, tokenHash));
  }

  async deleteSession(token: string) {
    const tokenHash = HashUtil.hashToken(token);
    await db.delete(customerSessions).where(eq(customerSessions.tokenHash, tokenHash));
  }

  async deleteAllSessions(customerId: string) {
    await db.delete(customerSessions).where(eq(customerSessions.customerId, customerId));
  }

  /** Keep the device that just changed password; revoke the rest. */
  async deleteOtherSessions(customerId: string, keepRawToken: string) {
    const keepHash = HashUtil.hashToken(keepRawToken);
    await db
      .delete(customerSessions)
      .where(and(eq(customerSessions.customerId, customerId), ne(customerSessions.tokenHash, keepHash)));
  }

  async hasCompletedOrder(customerId: string): Promise<boolean> {
    const row = await db.query.orders.findFirst({
      where: and(eq(orders.customerId, customerId), eq(orders.orderStatus, 'completed')),
      columns: { orderCode: true },
    });
    return !!row;
  }
}

export const customerRepository = new CustomerRepository();
