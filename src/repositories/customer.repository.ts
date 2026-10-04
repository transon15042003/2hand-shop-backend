import { db } from '../configs/database.js';
import { customers, customerSessions } from '../db/schema.js';
import { eq, or, and, gt } from 'drizzle-orm';
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

  async deleteSession(token: string) {
    const tokenHash = HashUtil.hashToken(token);
    await db.delete(customerSessions).where(eq(customerSessions.tokenHash, tokenHash));
  }
}

export const customerRepository = new CustomerRepository();
