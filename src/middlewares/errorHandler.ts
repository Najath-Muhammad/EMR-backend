import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { errorResponse } from '../dtos/ApiResponse';
import { logger } from '../utils/logger';
import { HTTP_STATUS } from '../constants/httpStatus';
import { MESSAGES } from '../constants/messages';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Zod validation errors -> 422
  if (err instanceof ZodError) {
    const message = err.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json(errorResponse(message));
    return;
  }

  // Known operational application errors
  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json(errorResponse(err.message));
    return;
  }

  // MongoDB duplicate key error (code 11000) - e.g. atomic unique partial index violation
  if ('code' in err && (err as { code: unknown }).code === 11000) {
    const errObj = err as { keyPattern?: Record<string, unknown>; message?: string };
    if (errObj.keyPattern?.['department'] || errObj.message?.includes('department')) {
      res.status(HTTP_STATUS.CONFLICT).json(errorResponse(MESSAGES.RECEPTIONIST_LIMIT_EXCEEDED));
      return;
    }
    res.status(HTTP_STATUS.CONFLICT).json(errorResponse('A record with these unique details already exists.'));
    return;
  }

  // Unknown / programmer errors - log internally, return sanitized message to client
  logger.error('Unexpected internal error', {
    name: err.name,
    message: err.message,
  });

  res
    .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    .json(errorResponse('An unexpected error occurred. Please try again later.'));
}
