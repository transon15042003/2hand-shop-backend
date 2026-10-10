import { z } from 'zod';

const phoneSchema = z.string().regex(/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/, 'Số điện thoại không đúng định dạng');

export const registerSchema = z.object({
  name: z.string().min(2, 'Họ và tên phải có ít nhất 2 ký tự'),
  phone: phoneSchema,
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  defaultShippingAddress: z.string().optional(),
  defaultShippingNote: z.string().optional(),
});

export const loginSchema = z.object({
  identifier: phoneSchema,
  password: z.string().min(1, 'Vui lòng nhập Mật khẩu'),
});

export const verifyEmailSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  code: z.string().length(6, 'Mã OTP gồm 6 chữ số'),
});

export const resendCodeSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Họ và tên phải có ít nhất 2 ký tự'),
  default_shipping_address: z.string().nullable().optional(),
  default_shipping_note: z.string().nullable().optional(),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  new_password: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự'),
});

export const adminLoginSchema = z.object({
  username: z.string().min(1, 'Vui lòng nhập tên đăng nhập'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export const createAdminSchema = z.object({
  username: z.string().min(3, 'Username phải có ít nhất 3 ký tự'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  display_name: z.string().min(1, 'Vui lòng nhập tên hiển thị'),
  role: z.enum(['owner', 'staff']),
  permissions: z
    .array(
      z.enum(['items', 'orders', 'deposits', 'batches', 'cash_flow', 'settings', 'manage_admins'])
    )
    .optional(),
});

export const updateAdminSchema = z
  .object({
    display_name: z.string().min(1).optional(),
    role: z.enum(['owner', 'staff']).optional(),
    permissions: z
      .array(
        z.enum(['items', 'orders', 'deposits', 'batches', 'cash_flow', 'settings', 'manage_admins'])
      )
      .optional(),
    password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').optional(),
    is_active: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Không có trường nào để cập nhật' });
