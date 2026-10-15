import { Request, Response } from 'express';
import { IScheduleController } from '../interfaces/IScheduleController';
import { IScheduleService } from '../../services/interfaces/IScheduleService';
import { successResponse } from '../../dtos/ApiResponse';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { MESSAGES } from '../../constants/messages';

export class ScheduleController implements IScheduleController {
  constructor(private readonly scheduleService: IScheduleService) {}

  async getSchedule(req: Request, res: Response): Promise<void> {
    const doctorId = req.params['id'] as string;
    const data = await this.scheduleService.getDoctorSchedule(doctorId);
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.SCHEDULE_FETCHED, data));
  }

  async saveSchedule(req: Request, res: Response): Promise<void> {
    const doctorId = req.params['id'] as string;
    const force = req.query['force'] === 'true';
    const data = await this.scheduleService.saveDoctorSchedule(doctorId, req.body, force);
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.SCHEDULE_SAVED, data));
  }

  async toggleStatus(req: Request, res: Response): Promise<void> {
    const doctorId = req.params['id'] as string;
    const isActive = Boolean(req.body.isActive);
    const data = await this.scheduleService.toggleDoctorScheduleStatus(doctorId, isActive);
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.SCHEDULE_STATUS_UPDATED, data));
  }
}
