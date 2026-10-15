import { Request, Response } from 'express';

export interface IAppointmentController {
  bookAppointment(req: Request, res: Response): Promise<void>;
  cancelAppointment(req: Request, res: Response): Promise<void>;
  markAsArrived(req: Request, res: Response): Promise<void>;
  completeAppointment(req: Request, res: Response): Promise<void>;
  updateAppointment(req: Request, res: Response): Promise<void>;
  updateConsultationNotes(req: Request, res: Response): Promise<void>;
  rescheduleAppointment(req: Request, res: Response): Promise<void>;
  getAppointmentById(req: Request, res: Response): Promise<void>;
  getAppointments(req: Request, res: Response): Promise<void>;
}
