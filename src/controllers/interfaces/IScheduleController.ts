import { Request, Response } from 'express';

export interface IScheduleController {
  getSchedule(req: Request, res: Response): Promise<void>;
  saveSchedule(req: Request, res: Response): Promise<void>;
  toggleStatus(req: Request, res: Response): Promise<void>;
}
