import { Request, Response, NextFunction } from 'express';

export interface IDoctorController {
  list(req: Request, res: Response, next?: NextFunction): Promise<void>;
  getById(req: Request, res: Response, next?: NextFunction): Promise<void>;
}
