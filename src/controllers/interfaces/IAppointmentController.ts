import { Request, Response, NextFunction } from 'express';

export interface IAppointmentController {
  bookAppointment(req: Request, res: Response, next?: NextFunction): Promise<void>;
  cancelAppointment(req: Request, res: Response, next?: NextFunction): Promise<void>;
  markAsArrived(req: Request, res: Response, next?: NextFunction): Promise<void>;
  completeAppointment(req: Request, res: Response, next?: NextFunction): Promise<void>;
  updateAppointment(req: Request, res: Response, next?: NextFunction): Promise<void>;
  updateConsultationNotes(req: Request, res: Response, next?: NextFunction): Promise<void>;
  rescheduleAppointment(req: Request, res: Response, next?: NextFunction): Promise<void>;
  getAppointmentById(req: Request, res: Response, next?: NextFunction): Promise<void>;
  getAppointments(req: Request, res: Response, next?: NextFunction): Promise<void>;
}
