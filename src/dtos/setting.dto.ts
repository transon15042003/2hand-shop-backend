import { z } from 'zod';

export const updateSettingsSchema = z.object({
  depositAmount: z.number().int().min(0).optional(),
  returnFee: z.number().int().min(0).optional(),
  returnWindowDays: z.number().int().min(1).optional(),
  orderHoldMinutes: z.number().int().min(5).max(120).optional(),
  shopPhone: z.string().optional(),
  shopZalo: z.string().optional(),
  shopMessengerUrl: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountHolder: z.string().optional(),
  bankQrImageUrl: z.string().optional(),
  shippingFeePresets: z.array(z.number().int().min(0)).optional(),
  defaultShippingFee: z.number().int().min(0).optional(),
  freeshipMinItems: z.number().int().min(1).optional(),
});
