import { Request, Response, NextFunction } from 'express';
import { IAppointmentController } from '../interfaces/IAppointmentController';
import { IAppointmentService } from '../../services/interfaces/IAppointmentService';
import {
  createAppointmentSchema,
  cancelAppointmentSchema,
  updateAppointmentSchema,
  completeAppointmentSchema,
  updateConsultationNotesSchema,
  rescheduleAppointmentSchema,
  appointmentQuerySchema,
} from '../../validators/appointment.validator';
import { successResponse } from '../../dtos/ApiResponse';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { MESSAGES } from '../../constants/messages';
import { UnauthorizedError } from '../../errors/AppError';

export class AppointmentController implements IAppointmentController {
  constructor(private readonly _appointmentService: IAppointmentService) {}

  async bookAppointment(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
      }

      const input = createAppointmentSchema.parse(req.body);
      const data = await this._appointmentService.bookAppointment(input, req.user.userId);
      res.status(HTTP_STATUS.CREATED).json(successResponse(MESSAGES.APPOINTMENT_CREATED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async cancelAppointment(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
      }

      const id = req.params['id'] as string;
      const body = cancelAppointmentSchema.parse(req.body);
      const data = await this._appointmentService.cancelAppointment(
        id,
        req.user.userId,
        body.reason,
      );
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.APPOINTMENT_CANCELLED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async markAsArrived(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
      }

      const id = req.params['id'] as string;
      const data = await this._appointmentService.markAsArrived(id, req.user.userId);
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.APPOINTMENT_ARRIVED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async completeAppointment(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
      }

      const id = req.params['id'] as string;
      const body = completeAppointmentSchema.parse(req.body);
      const data = await this._appointmentService.completeAppointment(
        id,
        { userId: req.user.userId, role: req.user.role },
        body.consultationNotes,
      );
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.APPOINTMENT_COMPLETED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async updateAppointment(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
      }

      const id = req.params['id'] as string;
      const body = updateAppointmentSchema.parse(req.body);
      const data = await this._appointmentService.updateAppointment(
        id,
        { userId: req.user.userId, role: req.user.role },
        body,
      );
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.APPOINTMENT_UPDATED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async updateConsultationNotes(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
      }

      const id = req.params['id'] as string;
      const body = updateConsultationNotesSchema.parse(req.body);
      const data = await this._appointmentService.updateConsultationNotes(
        id,
        { userId: req.user.userId, role: req.user.role },
        body.consultationNotes,
      );
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.APPOINTMENT_CONSULTATION_SAVED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async rescheduleAppointment(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
      }

      const id = req.params['id'] as string;
      const body = rescheduleAppointmentSchema.parse(req.body);
      const data = await this._appointmentService.rescheduleAppointment(
        id,
        { userId: req.user.userId, role: req.user.role },
        body,
      );
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.APPOINTMENT_RESCHEDULED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async getAppointmentById(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
      }

      const id = req.params['id'] as string;
      const data = await this._appointmentService.getAppointmentById(id, {
        userId: req.user.userId,
        role: req.user.role,
      });
      res.status(HTTP_STATUS.OK).json(successResponse(MESSAGES.APPOINTMENT_FETCHED, data));
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async getAppointments(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
      }

      const query = appointmentQuerySchema.parse(req.query);
      const result = await this._appointmentService.getAppointments(query, {
        userId: req.user.userId,
        role: req.user.role,
      });

      res.status(HTTP_STATUS.OK).json(
        successResponse(MESSAGES.APPOINTMENTS_FETCHED, result.appointments, {
          page: query.page || 1,
          limit: query.limit || 15,
          total: result.total,
          totalPages: result.totalPages,
        }),
      );
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }
}
