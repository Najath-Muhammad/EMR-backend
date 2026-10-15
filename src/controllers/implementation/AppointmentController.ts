import { Request, Response } from 'express';
import { IAppointmentController } from '../interfaces/IAppointmentController';
import { IAppointmentService } from '../../services/interfaces/IAppointmentService';
import {
  CreateAppointmentInput,
  CancelAppointmentInput,
  AppointmentQuery,
} from '../../validators/appointment.validator';
import { successResponse } from '../../dtos/ApiResponse';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { MESSAGES } from '../../constants/messages';
import { UnauthorizedError } from '../../errors/AppError';

export class AppointmentController implements IAppointmentController {
  constructor(private readonly appointmentService: IAppointmentService) {}

  async bookAppointment(req: Request, res: Response): Promise<void> {
    if (!req.user?.userId) {
      throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
    }

    const input = req.body as CreateAppointmentInput;
    const data = await this.appointmentService.bookAppointment(input, req.user.userId);
    res.status(HTTP_STATUS.CREATED).json(successResponse(MESSAGES.APPOINTMENT_CREATED, data));
  }

  async cancelAppointment(req: Request, res: Response): Promise<void> {
    if (!req.user?.userId) {
      throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
    }

    const id = req.params['id'] as string;
    const body = req.body as CancelAppointmentInput;
    const data = await this.appointmentService.cancelAppointment(
      id,
      req.user.userId,
      body.reason,
    );
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.APPOINTMENT_CANCELLED, data));
  }

  async getAppointmentById(req: Request, res: Response): Promise<void> {
    if (!req.user?.userId) {
      throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
    }

    const id = req.params['id'] as string;
    const data = await this.appointmentService.getAppointmentById(id, {
      userId: req.user.userId,
      role: req.user.role,
    });
    res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.APPOINTMENT_FETCHED, data));
  }

  async getAppointments(req: Request, res: Response): Promise<void> {
    if (!req.user?.userId) {
      throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
    }

    const query = req.query as unknown as AppointmentQuery;
    const result = await this.appointmentService.getAppointments(query, {
      userId: req.user.userId,
      role: req.user.role,
    });

    res.status(HTTP_STATUS.OK).json(
      successResponse(MESSAGES.APPOINTMENTS_FETCHED, result.appointments, {
        page: query.page || 1,
        limit: query.limit || 20,
        total: result.total,
        totalPages: result.totalPages,
      }),
    );
  }
}
