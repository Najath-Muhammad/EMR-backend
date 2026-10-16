import { Request, Response, NextFunction } from 'express';

export interface IStaffController {
  create(req: Request, res: Response, next?: NextFunction): Promise<void>;
  getById(req: Request, res: Response, next?: NextFunction): Promise<void>;
  update(req: Request, res: Response, next?: NextFunction): Promise<void>;
  toggleStatus(req: Request, res: Response, next?: NextFunction): Promise<void>;
  list(req: Request, res: Response, next?: NextFunction): Promise<void>;
  resendActivation(req: Request, res: Response, next?: NextFunction): Promise<void>;
  activate(req: Request, res: Response, next?: NextFunction): Promise<void>;
}
