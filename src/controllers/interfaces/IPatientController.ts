import { Request, Response, NextFunction } from 'express';

export interface IPatientController {
  checkDuplicates(req: Request, res: Response, next?: NextFunction): Promise<void>;
  createPatient(req: Request, res: Response, next?: NextFunction): Promise<void>;
  getPatients(req: Request, res: Response, next?: NextFunction): Promise<void>;
  getPatientById(req: Request, res: Response, next?: NextFunction): Promise<void>;
  updatePatient(req: Request, res: Response, next?: NextFunction): Promise<void>;
}
