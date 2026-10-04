import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export class HashUtil {
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  static generateOtp(digits = 6): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
