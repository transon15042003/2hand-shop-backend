import { z } from 'zod';

export const createBatchBodySchema = z.object({
  code: z.string().min(1, 'Nhập mã kiện.').transform((s) => s.trim().toUpperCase()),
  name: z.string().min(1, 'Nhập tên kiện.'),
  import_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày nhập không hợp lệ (YYYY-MM-DD).'),
  initial_capital: z.number().int().min(0, 'Vốn kiện phải ≥ 0.'),
  processing_cost: z.number().int().min(0, 'Chi phí xử lý phải ≥ 0.').default(0),
});

export const cashFlowSummaryQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']).optional().default('week'),
});

export const createReconciliationBodySchema = z.object({
  session_code: z.string().min(1, 'Nhập mã phiên.'),
  carrier_name: z.string().min(1, 'Nhập hãng vận chuyển.'),
  order_ids: z.array(z.string().min(1)).min(1, 'Chọn ít nhất một đơn.'),
  total_cod_collected: z.number().int().min(0),
  carrier_shipping_fee: z.number().int().min(0),
  net_amount_transferred: z.number().int().min(0),
  transfer_date: z.string().min(1, 'Nhập ngày tiền về.'),
});
