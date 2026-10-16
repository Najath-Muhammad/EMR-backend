import { Request, Response, NextFunction } from 'express';
import { IHealthController } from '../interfaces/IHealthController';
import { IHealthService } from '../../services/interfaces/IHealthService';
import { successResponse } from '../../dtos/ApiResponse';
import { MESSAGES } from '../../constants/messages';
import { HTTP_STATUS } from '../../constants/httpStatus';

export class HealthController implements IHealthController {
  constructor(private readonly _healthService: IHealthService) {}

  getHealth(_req: Request, res: Response, next?: NextFunction): void {
    try {
      const data = this._healthService.getStatus();
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.HEALTH_OK, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }
}
