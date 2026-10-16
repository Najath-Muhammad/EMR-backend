import { Request, Response, NextFunction } from 'express';
import { IScheduleController } from '../interfaces/IScheduleController';
import { IScheduleService } from '../../services/interfaces/IScheduleService';
import { successResponse } from '../../dtos/ApiResponse';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { MESSAGES } from '../../constants/messages';
import { saveScheduleSchema } from '../../validators/schedule.validator';

export class ScheduleController implements IScheduleController {
  constructor(private readonly _scheduleService: IScheduleService) {}

  async getSchedule(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const doctorId = req.params['id'] as string;
      const data = await this._scheduleService.getDoctorSchedule(doctorId);
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.SCHEDULE_FETCHED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async saveSchedule(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const doctorId = req.params['id'] as string;
      const force = req.query['force'] === 'true';
      const validatedBody = saveScheduleSchema.parse(req.body);
      const data = await this._scheduleService.saveDoctorSchedule(doctorId, validatedBody, force);
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.SCHEDULE_SAVED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async toggleStatus(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const doctorId = req.params['id'] as string;
      const isActive = Boolean(req.body.isActive);
      const data = await this._scheduleService.toggleDoctorScheduleStatus(doctorId, isActive);
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.SCHEDULE_STATUS_UPDATED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }
}
