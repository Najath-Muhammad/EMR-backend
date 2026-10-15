import { Request, Response } from 'express';

export interface IStaffController {
  create(req: Request, res: Response): Promise<void>;
  getById(req: Request, res: Response): Promise<void>;
  update(req: Request, res: Response): Promise<void>;
  toggleStatus(req: Request, res: Response): Promise<void>;
  list(req: Request, res: Response): Promise<void>;
  resendActivation(req: Request, res: Response): Promise<void>;
  activate(req: Request, res: Response): Promise<void>;
}
