import { Request, Response } from 'express';

export interface IDoctorController {
  list(req: Request, res: Response): Promise<void>;
  getById(req: Request, res: Response): Promise<void>;
}
