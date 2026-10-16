import { Request, Response, NextFunction } from 'express';

export interface IDepartmentController {
  create(req: Request, res: Response, next?: NextFunction): Promise<void>;
  getById(req: Request, res: Response, next?: NextFunction): Promise<void>;
  update(req: Request, res: Response, next?: NextFunction): Promise<void>;
  toggleStatus(req: Request, res: Response, next?: NextFunction): Promise<void>;
  list(req: Request, res: Response, next?: NextFunction): Promise<void>;
  listActive(req: Request, res: Response, next?: NextFunction): Promise<void>;
}
