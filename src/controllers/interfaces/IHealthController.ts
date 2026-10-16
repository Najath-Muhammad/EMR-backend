import { Request, Response, NextFunction } from 'express';

export interface IHealthController {
  getHealth(req: Request, res: Response, next?: NextFunction): void;
}
