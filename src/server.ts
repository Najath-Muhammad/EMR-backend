import http from 'http';
import { createApp } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { logger } from './utils/logger';
import { initSocket } from './socket';

async function bootstrap(): Promise<void> {

  await connectDB();

  const app = createApp();
  const httpServer = http.createServer(app);

  initSocket(httpServer);

  httpServer.on('error', (err: NodeJS.ErrnoException): void => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${env.PORT} is already in use.`);
    } else {
      logger.error('HTTP server encountered an error', { error: err.message });
    }
    process.exit(1);
  });

  httpServer.listen(env.PORT, () => {
    logger.info(`🚀  EMR Backend running on http://localhost:${env.PORT}`);
    logger.info(`   Environment : ${env.NODE_ENV}`);
    logger.info(`   API Base    : http://localhost:${env.PORT}/api/v1`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down gracefully…`);
    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT',  () => { void shutdown('SIGINT'); });
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal startup error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
