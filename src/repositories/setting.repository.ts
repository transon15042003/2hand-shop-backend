import { db } from '../configs/database.js';
import { shopSettings } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export class SettingRepository {
  async getSettings() {
    let settings = await db.query.shopSettings.findFirst({
      where: eq(shopSettings.id, 1),
    });

    if (!settings) {
      const [inserted] = await db
        .insert(shopSettings)
        .values({
          id: 1,
          depositAmount: 50000,
          returnFee: 50000,
          returnWindowDays: 2,
          orderHoldMinutes: 30,
          policyVersion: 1,
          shopPhone: '0900000000',
          shopZalo: '0900000000',
          bankName: 'Vietcombank',
          bankAccountNumber: '0000000000',
          bankAccountHolder: 'CHU SHOP',
          shippingFeePresets: [20000, 30000],
          defaultShippingFee: 30000,
          freeshipMinItems: 4,
        })
        .returning();
      settings = inserted;
    }

    return settings;
  }

  async updateSettings(data: Partial<typeof shopSettings.$inferInsert>) {
    const existing = await this.getSettings();

    // Tự tăng policyVersion nếu các thông số cốt lõi thay đổi theo ADR 005
    const coreChanged =
      (data.depositAmount !== undefined && data.depositAmount !== existing.depositAmount) ||
      (data.returnFee !== undefined && data.returnFee !== existing.returnFee) ||
      (data.returnWindowDays !== undefined && data.returnWindowDays !== existing.returnWindowDays) ||
      (data.orderHoldMinutes !== undefined && data.orderHoldMinutes !== existing.orderHoldMinutes) ||
      (data.defaultShippingFee !== undefined && data.defaultShippingFee !== existing.defaultShippingFee) ||
      (data.freeshipMinItems !== undefined && data.freeshipMinItems !== existing.freeshipMinItems);

    const newPolicyVersion = coreChanged ? existing.policyVersion + 1 : existing.policyVersion;

    const [updated] = await db
      .update(shopSettings)
      .set({
        ...data,
        policyVersion: newPolicyVersion,
        updatedAt: new Date(),
      })
      .where(eq(shopSettings.id, 1))
      .returning();

    return updated;
  }
}

export const settingRepository = new SettingRepository();
