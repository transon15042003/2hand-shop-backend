import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Họ và tên phải có ít nhất 2 ký tự'),
  phone: z.string().regex(/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/, 'Số điện thoại không đúng định dạng'),
  email: z.string().email('Email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  defaultShippingAddress: z.string().optional(),
  defaultShippingNote: z.string().optional(),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Vui lòng nhập Email hoặc Số điện thoại'),
  password: z.string().min(1, 'Vui lòng nhập Mật khẩu'),
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  otp: z.string().length(6, 'Mã OTP gồm 6 chữ số'),
});

export const resendOtpSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
});

export const adminLoginSchema = z.object({
  password: z.string().min(1, 'Vui lòng nhập mã truy cập quản trị'),
});
