import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { appConfig } from './configs/app.config.js';
import routes from './routes/index.js';
import { errorMiddleware } from './middlewares/error.middleware.js';

export function createApp() {
  const app = express();

  // Middlewares
  app.use(
    cors({
      origin: [appConfig.corsOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Mount API
  app.use('/api', routes);

  // Global Error Handler
  app.use(errorMiddleware);

  return app;
}
