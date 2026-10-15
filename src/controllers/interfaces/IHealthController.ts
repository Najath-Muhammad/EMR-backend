import { Request, Response } from 'express';

export interface IHealthController {
  getHealth(req: Request, res: Response): void;
}
