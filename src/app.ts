import express, { Application, Request, Response } from 'express';
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

  app.set('trust proxy', 1);

  app.use(helmet());

  const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim().replace(/\/+$/, ''));

  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin) {
          return callback(null, true);
        }
        const normalized = requestOrigin.replace(/\/+$/, '');
        if (
          allowedOrigins.includes(normalized) ||
          normalized.endsWith('.vercel.app') ||
          normalized.startsWith('http://localhost:') ||
          normalized === 'http://localhost'
        ) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept', 'Origin'],
      exposedHeaders: ['Set-Cookie'],
    }),
  );

  app.use(cookieParser());

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  }

  app.get('/', (_req: Request, res: Response): void => {
    res.status(200).json({ status: 'ok', service: 'emr-backend' });
  });

  app.get('/health', (_req: Request, res: Response): void => {
    res.status(200).json({ status: 'ok', service: 'emr-backend' });
  });

  app.use(router);

  app.use(notFound);

  app.use(errorHandler);

  return app;
}
