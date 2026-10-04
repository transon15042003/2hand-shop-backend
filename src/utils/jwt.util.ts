import jwt from 'jsonwebtoken';
import { appConfig } from '../configs/app.config.js';

export class JwtUtil {
  static sign(payload: object, expiresIn: string | number = '400d'): string {
    return jwt.sign(payload, appConfig.jwtSecret, { expiresIn: expiresIn as any });
  }

  static verify<T = any>(token: string): T | null {
    try {
      return jwt.verify(token, appConfig.jwtSecret) as T;
    } catch {
      return null;
    }
  }
}
