import { env } from '../config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  const currentLevel = (env.LOG_LEVEL as LogLevel) ?? 'info';
  return levels[level] >= levels[currentLevel];
}

function formatMessage(level: LogLevel, message: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${ts}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  debug: (msg: string, meta?: unknown): void => {
    if (shouldLog('debug')) console.debug(formatMessage('debug', msg, meta));
  },
  info: (msg: string, meta?: unknown): void => {
    if (shouldLog('info')) console.info(formatMessage('info', msg, meta));
  },
  warn: (msg: string, meta?: unknown): void => {
    if (shouldLog('warn')) console.warn(formatMessage('warn', msg, meta));
  },
  error: (msg: string, meta?: unknown): void => {
    if (shouldLog('error')) console.error(formatMessage('error', msg, meta));
  },
};
