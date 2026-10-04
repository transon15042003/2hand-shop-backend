import { customerRepository } from '../repositories/customer.repository.js';
import { HashUtil } from '../utils/hash.util.js';
import { AppError } from '../middlewares/error.middleware.js';
import { HttpStatus, ErrorCode } from '../constants/http-status.js';

export class AuthService {
  async register(data: {
    name: string;
    phone: string;
    email: string;
    password: string;
    defaultShippingAddress?: string;
    defaultShippingNote?: string;
  }) {
    const existingEmail = await customerRepository.findByEmail(data.email);
    if (existingEmail) {
      throw new AppError('Email này đã được đăng ký', HttpStatus.CONFLICT, ErrorCode.EMAIL_ALREADY_EXISTS, {
        email: 'Email đã tồn tại',
      });
    }

    const existingPhone = await customerRepository.findByPhone(data.phone);
    if (existingPhone) {
      throw new AppError('Số điện thoại này đã được đăng ký', HttpStatus.CONFLICT, ErrorCode.PHONE_ALREADY_EXISTS, {
        phone: 'Số điện thoại đã tồn tại',
      });
    }

    const passwordHash = await HashUtil.hashPassword(data.password);
    const otp = HashUtil.generateOtp(6);
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    const customerId = `kh-${Date.now().toString(36)}`;

    await customerRepository.create({
      id: customerId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      passwordHash,
      isVerified: false,
      verificationOtp: otp,
      otpExpiresAt,
      defaultShippingAddress: data.defaultShippingAddress,
      defaultShippingNote: data.defaultShippingNote,
    });

    return {
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để nhập mã xác thực OTP.',
      email: data.email,
      debugOtp: process.env.NODE_ENV === 'development' ? otp : undefined,
    };
  }

  async verifyOtp(email: string, otp: string) {
    const customer = await customerRepository.findByEmail(email);
    if (!customer) {
      throw new AppError('Không tìm thấy tài khoản với email này', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
    }

    if (customer.isVerified) {
      return { message: 'Tài khoản đã được xác thực trước đó.' };
    }

    if (!customer.verificationOtp || customer.verificationOtp !== otp) {
      throw new AppError('Mã OTP không chính xác', HttpStatus.BAD_REQUEST, ErrorCode.INVALID_OTP);
    }

    if (customer.otpExpiresAt && customer.otpExpiresAt < new Date()) {
      throw new AppError('Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới', HttpStatus.BAD_REQUEST, ErrorCode.OTP_EXPIRED);
    }

    await customerRepository.update(customer.id, {
      isVerified: true,
      verificationOtp: null,
      otpExpiresAt: null,
    });

    const sessionToken = await customerRepository.createSession(customer.id);

    return {
      sessionToken,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
    };
  }

  async resendOtp(email: string) {
    const customer = await customerRepository.findByEmail(email);
    if (!customer) {
      throw new AppError('Không tìm thấy tài khoản với email này', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
    }

    const otp = HashUtil.generateOtp(6);
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await customerRepository.update(customer.id, {
      verificationOtp: otp,
      otpExpiresAt,
    });

    return {
      message: 'Mã xác thực mới đã được gửi tới email của bạn.',
      debugOtp: process.env.NODE_ENV === 'development' ? otp : undefined,
    };
  }

  async login(identifier: string, password: string) {
    const customer = await customerRepository.findByIdentifier(identifier);
    if (!customer) {
      throw new AppError('Thông tin đăng nhập không chính xác', HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS);
    }

    const isMatch = await HashUtil.comparePassword(password, customer.passwordHash);
    if (!isMatch) {
      throw new AppError('Thông tin đăng nhập không chính xác', HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS);
    }

    if (!customer.isVerified) {
      throw new AppError('Tài khoản chưa được xác thực email. Vui lòng nhập mã OTP', HttpStatus.UNAUTHORIZED, ErrorCode.EMAIL_NOT_VERIFIED, {
        email: customer.email,
      });
    }

    const sessionToken = await customerRepository.createSession(customer.id);

    return {
      sessionToken,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        defaultShippingAddress: customer.defaultShippingAddress,
        defaultShippingNote: customer.defaultShippingNote,
      },
    };
  }

  async logout(sessionToken?: string) {
    if (sessionToken) {
      await customerRepository.deleteSession(sessionToken);
    }
    return { success: true };
  }
}

export const authService = new AuthService();
