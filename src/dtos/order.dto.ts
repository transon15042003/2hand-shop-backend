import { z } from 'zod';

export const createOrderSchema = z.object({
  customer_name: z.string().min(2, 'Họ tên người nhận phải có ít nhất 2 ký tự'),
  customer_phone: z.string().regex(/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/, 'Số điện thoại không đúng định dạng'),
  shipping_address: z.string().min(5, 'Địa chỉ giao hàng phải có ít nhất 5 ký tự'),
  customer_note: z.string().optional(),
  item_ids: z.array(z.string()).min(1, 'Đơn hàng phải có ít nhất 1 sản phẩm'),
  payment_method: z.enum(['bank_transfer', 'cod']),
  policy_accepted: z.literal(true, {
    errorMap: () => ({ message: 'Bạn cần đồng ý với chính sách cọc và đổi trả của tiệm' }),
  }),
  policy_version: z.number().int().positive(),
});

export const trackOrderSchema = z.object({
  order_code: z.string().min(1, 'Mã đơn hàng không được để trống'),
  phone: z.string().regex(/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/, 'Số điện thoại không đúng định dạng'),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(2, 'Vui lòng cung cấp lý do hủy đơn').optional(),
  order_code: z.string().optional(),
  phone: z.string().optional(),
  expected_status: z.enum(['new', 'confirmed', 'shipping', 'completed', 'cancelled', 'returned']).optional(),
});

export const extendHoldSchema = z.object({
  minutes: z.number().int().min(1).max(30),
});

export const checkDepositSchema = z.object({
  phone: z.string().regex(/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/, 'Số điện thoại không đúng định dạng'),
});
