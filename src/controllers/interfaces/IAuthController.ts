import { Request, Response, NextFunction } from 'express';

export interface IAuthController {
  login(req: Request, res: Response, next?: NextFunction): Promise<void>;
  refresh(req: Request, res: Response, next?: NextFunction): Promise<void>;
  logout(req: Request, res: Response, next?: NextFunction): Promise<void>;
  getMe(req: Request, res: Response, next?: NextFunction): Promise<void>;
}
