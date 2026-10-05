import dotenv from 'dotenv';
dotenv.config();

export const appConfig = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/twohand_shop',
  jwtSecret: process.env.JWT_SECRET || 'twohand_shop_jwt_secret_dev_key_2026',
  adminSessionToken: process.env.ADMIN_SESSION_TOKEN || 'twohand_admin_token_2026',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
};
