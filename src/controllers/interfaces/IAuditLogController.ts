import { Request, Response, NextFunction } from 'express';

export interface IAuditLogController {
  getAuditLogs(req: Request, res: Response, next?: NextFunction): Promise<void>;
  getAuditLogById(req: Request, res: Response, next?: NextFunction): Promise<void>;
}
