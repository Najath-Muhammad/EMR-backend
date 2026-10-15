import { Request, Response } from 'express';
import { errorResponse } from '../dtos/ApiResponse';
import { HTTP_STATUS } from '../constants/httpStatus';

export function notFound(req: Request, res: Response): void {
  res
    .status(HTTP_STATUS.NOT_FOUND)
    .json(errorResponse(`Route ${req.method} ${req.originalUrl} not found`));
}
