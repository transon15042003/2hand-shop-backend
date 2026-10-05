import { z } from 'zod';

export const adminOrdersQuerySchema = z.object({
  order_status: z
    .enum(['new', 'confirmed', 'shipping', 'completed', 'returned', 'cancelled'])
    .optional(),
  payment_status: z.enum(['unpaid', 'pending_cod', 'paid', 'partial', 'refunded']).optional(),
  carrier_name: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['newest', 'oldest', 'total_desc', 'total_asc']).optional().default('newest'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(15),
});

export const confirmOrderBodySchema = z.object({
  shipping_fee: z.number().int().min(0).optional(),
  note: z.string().max(500).optional(),
});

export const fulfillOrderBodySchema = z.object({
  carrier_name: z.string().min(1, 'Nhập hãng vận chuyển.'),
  tracking_code: z.string().min(1, 'Nhập mã vận đơn.'),
  actual_shipping_cost: z.number().int().min(0, 'Cước thực trả phải ≥ 0.'),
  note: z.string().max(500).optional(),
});

export const updateOrderStatusBodySchema = z
  .object({
    status: z.enum(['completed', 'returned', 'cancelled']),
    reason: z.string().max(300).optional(),
    return_shipping_fee: z.number().int().min(0).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.status === 'cancelled' && (!body.reason || body.reason.trim().length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'Nhập lý do hủy đơn (ít nhất 3 ký tự).',
      });
    }
  });

export const markDepositBodySchema = z.object({
  note: z.string().max(500).optional(),
});

export const extendHoldBodySchema = z.object({
  minutes: z.number().int().min(1, 'Số phút gia hạn phải ≥ 1.'),
});

export const updatePaymentBodySchema = z.object({
  payment_status: z.literal('paid'),
  note: z.string().max(500).optional(),
});
