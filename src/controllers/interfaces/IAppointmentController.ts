import { Request, Response } from 'express';

export interface IAppointmentController {
  bookAppointment(req: Request, res: Response): Promise<void>;
  cancelAppointment(req: Request, res: Response): Promise<void>;
  getAppointmentById(req: Request, res: Response): Promise<void>;
  getAppointments(req: Request, res: Response): Promise<void>;
}
