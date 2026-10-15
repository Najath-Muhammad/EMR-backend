import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { errorResponse } from '../dtos/ApiResponse';
import { logger } from '../utils/logger';
import { HTTP_STATUS } from '../constants/httpStatus';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Zod validation errors → 422
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

  // Unknown / programmer errors — log internally, generic message to client
  logger.error('Unexpected internal error', {
    name: err.name,
    message: err.message,
  });

  res
    .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    .json(errorResponse('An unexpected error occurred. Please try again later.'));
}
