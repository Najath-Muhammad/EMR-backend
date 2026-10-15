import { Request, Response } from 'express';
import { IHealthController } from '../interfaces/IHealthController';
import { IHealthService } from '../../services/interfaces/IHealthService';
import { successResponse } from '../../dtos/ApiResponse';
import { MESSAGES } from '../../constants/messages';
import { HTTP_STATUS } from '../../constants/httpStatus';

export class HealthController implements IHealthController {
  constructor(private readonly healthService: IHealthService) {}

  getHealth(_req: Request, res: Response): void {
    const data = this.healthService.getStatus();
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.HEALTH_OK, data));
  }
}
