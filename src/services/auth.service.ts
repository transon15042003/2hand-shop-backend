import { customerRepository } from '../repositories/customer.repository.js';
import { HashUtil } from '../utils/hash.util.js';
import { AppError } from '../middlewares/error.middleware.js';
import { HttpStatus, ErrorCode } from '../constants/http-status.js';
type CustomerRow = NonNullable<Awaited<ReturnType<typeof customerRepository.findById>>>;

export type CustomerProfile = {
  id: string;
  name: string;
  phone: string;
  is_verified: boolean;
  has_completed_order: boolean;
  default_shipping_address: string | null;
  default_shipping_note: string | null;
  created_at: string;
};

export class AuthService {
  async toProfile(customer: CustomerRow): Promise<CustomerProfile> {
    const hasCompleted = await customerRepository.hasCompletedOrder(customer.id);
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      is_verified: customer.isVerified,
      has_completed_order: hasCompleted,
      default_shipping_address: customer.defaultShippingAddress ?? null,
      default_shipping_note: customer.defaultShippingNote ?? null,
      created_at: (customer.createdAt ?? new Date()).toISOString(),
    };
  }

  async register(data: {
    name: string;
    phone: string;
    password: string;
    defaultShippingAddress?: string;
    defaultShippingNote?: string;
  }) {
    const existingPhone = await customerRepository.findByPhone(data.phone);
    if (existingPhone) {
      throw new AppError('Số điện thoại này đã được đăng ký', HttpStatus.CONFLICT, ErrorCode.PHONE_ALREADY_EXISTS, {
        phone: 'Số điện thoại đã tồn tại',
      });
    }

    const passwordHash = await HashUtil.hashPassword(data.password);
    const customerId = `kh-${Date.now().toString(36)}`;

    const created = await customerRepository.create({
      id: customerId,
      name: data.name,
      phone: data.phone,
      passwordHash,
      isVerified: true,
      defaultShippingAddress: data.defaultShippingAddress,
      defaultShippingNote: data.defaultShippingNote,
    });

    const token = await customerRepository.createSession(customerId);

    return {
      success: true,
      message: 'Đăng ký tài khoản thành công.',
      requires_verification: false,
      customer_id: customerId,
      token,
      customer: await this.toProfile(created),
    };
  }

  async verifyEmail(email: string, code: string) {
    const customer = await customerRepository.findByEmail(email);
    if (!customer) {
      throw new AppError('Không tìm thấy tài khoản với email này', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
    }

    if (customer.isVerified) {
      throw new AppError('Tài khoản đã được xác thực trước đó', HttpStatus.BAD_REQUEST, ErrorCode.ALREADY_VERIFIED);
    }

    if (!customer.verificationOtp || customer.verificationOtp !== code) {
      throw new AppError('Mã OTP không chính xác', HttpStatus.BAD_REQUEST, ErrorCode.INVALID_OTP_CODE);
    }

    if (customer.otpExpiresAt && customer.otpExpiresAt < new Date()) {
      throw new AppError('Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới', HttpStatus.BAD_REQUEST, ErrorCode.OTP_EXPIRED);
    }

    const updated = await customerRepository.update(customer.id, {
      isVerified: true,
      verificationOtp: null,
      otpExpiresAt: null,
    });

    const token = await customerRepository.createSession(customer.id);
    return {
      token,
      customer: await this.toProfile(updated ?? customer),
    };
  }

  async resendCode(email: string) {
    const customer = await customerRepository.findByEmail(email);
    if (!customer) {
      throw new AppError('Không tìm thấy tài khoản với email này', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
    }

    if (customer.isVerified) {
      throw new AppError('Tài khoản đã được xác thực trước đó', HttpStatus.BAD_REQUEST, ErrorCode.ALREADY_VERIFIED);
    }

    const otp = HashUtil.generateOtp(6);
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await customerRepository.update(customer.id, {
      verificationOtp: otp,
      otpExpiresAt,
    });

    return {
      success: true,
      message: 'Mã xác thực mới đã được gửi tới email của bạn.',
      demo_otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    };
  }

  async login(identifier: string, password: string) {
    const customer = await customerRepository.findByPhone(identifier);
    if (!customer) {
      throw new AppError('Thông tin đăng nhập không chính xác', HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS);
    }

    const isMatch = await HashUtil.comparePassword(password, customer.passwordHash);
    if (!isMatch) {
      throw new AppError('Thông tin đăng nhập không chính xác', HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS);
    }

    const token = await customerRepository.createSession(customer.id);
    const profile = await this.toProfile(customer);

    return {
      token,
      customer: profile,
    };
  }

  async logout(sessionToken?: string) {
    if (sessionToken) {
      await customerRepository.deleteSession(sessionToken);
    }
    return { success: true, message: 'Đã đăng xuất' };
  }

  async logoutAll(customerId: string) {
    await customerRepository.deleteAllSessions(customerId);
    return { success: true, message: 'Đã đăng xuất khỏi mọi thiết bị' };
  }

  async getProfile(customerId: string) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new AppError('Tài khoản không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
    }
    return this.toProfile(customer);
  }

  async updateProfile(
    customerId: string,
    data: { name: string; default_shipping_address?: string | null; default_shipping_note?: string | null }
  ) {
    const updated = await customerRepository.update(customerId, {
      name: data.name,
      defaultShippingAddress: data.default_shipping_address ?? null,
      defaultShippingNote: data.default_shipping_note ?? null,
    });
    if (!updated) {
      throw new AppError('Tài khoản không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
    }
    return this.toProfile(updated);
  }

  async changePassword(customerId: string, currentPassword: string, newPassword: string, keepSessionToken: string) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new AppError('Tài khoản không tồn tại', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
    }

    const ok = await HashUtil.comparePassword(currentPassword, customer.passwordHash);
    if (!ok) {
      throw new AppError('Mật khẩu hiện tại không đúng', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, {
        current_password: 'Mật khẩu hiện tại không đúng',
      });
    }

    const passwordHash = await HashUtil.hashPassword(newPassword);
    await customerRepository.update(customerId, { passwordHash });
    await customerRepository.deleteOtherSessions(customerId, keepSessionToken);

    return { success: true, message: 'Đã đổi mật khẩu.' };
  }
}

export const authService = new AuthService();
