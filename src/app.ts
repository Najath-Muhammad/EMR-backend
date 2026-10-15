import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import router from './routes';
import { notFound } from './middlewares/notFound';
import { errorHandler } from './middlewares/errorHandler';

export function createApp(): Application {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS with credentials for cookies
  app.use(
    cors({
      origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // Cookie parsing
  app.use(cookieParser());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // HTTP request logging (dev only)
  if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  }

  // API routes
  app.use(router);

  // 404 handler (after routes)
  app.use(notFound);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}
