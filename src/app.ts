import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { appConfig } from './configs/app.config.js';
import routes from './routes/index.js';
import { errorMiddleware } from './middlewares/error.middleware.js';

export function createApp() {
  const app = express();

  // Render / reverse proxies — needed for correct client IP in rate limits.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // API-only JSON; no need for restrictive CSP that targets HTML apps.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  const corsOrigins = appConfig.isDev
    ? [appConfig.corsOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000']
    : [appConfig.corsOrigin];

  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Mount API
  app.use('/api', routes);

  // Global Error Handler
  app.use(errorMiddleware);

  return app;
}
