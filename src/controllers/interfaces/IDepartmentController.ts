import { Request, Response } from 'express';

export interface IDepartmentController {
  create(req: Request, res: Response): Promise<void>;
  getById(req: Request, res: Response): Promise<void>;
  update(req: Request, res: Response): Promise<void>;
  toggleStatus(req: Request, res: Response): Promise<void>;
  list(req: Request, res: Response): Promise<void>;
  listActive(req: Request, res: Response): Promise<void>;
}
