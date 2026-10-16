import { Request, Response, NextFunction } from 'express';

export interface IScheduleController {
  getSchedule(req: Request, res: Response, next?: NextFunction): Promise<void>;
  saveSchedule(req: Request, res: Response, next?: NextFunction): Promise<void>;
  toggleStatus(req: Request, res: Response, next?: NextFunction): Promise<void>;
}
