import { Request, Response } from 'express';

export interface IAuditLogController {
  getAuditLogs(req: Request, res: Response): Promise<void>;
  getAuditLogById(req: Request, res: Response): Promise<void>;
}
