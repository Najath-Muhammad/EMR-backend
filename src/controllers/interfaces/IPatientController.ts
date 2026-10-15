import { Request, Response } from 'express';

export interface IPatientController {
  checkDuplicates(req: Request, res: Response): Promise<void>;
  createPatient(req: Request, res: Response): Promise<void>;
  getPatients(req: Request, res: Response): Promise<void>;
  getPatientById(req: Request, res: Response): Promise<void>;
  updatePatient(req: Request, res: Response): Promise<void>;
}
