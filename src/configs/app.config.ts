import dotenv from 'dotenv';
dotenv.config();

export const appConfig = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/hk_small_store',
  jwtSecret: process.env.JWT_SECRET || 'hk_small_store_jwt_secret_dev_key_2026',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  /** Hold expire poll interval. Default 3 minutes; set 0 to disable in-process scheduler. */
  holdExpireIntervalMs: parseInt(process.env.HOLD_EXPIRE_INTERVAL_MS ?? '180000', 10),
  /** Email sender configuration */
  emailFrom: process.env.EMAIL_FROM || 'HK Small Store <no-reply@hksmallstore.com>',
  resendApiKey: process.env.RESEND_API_KEY,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
};
