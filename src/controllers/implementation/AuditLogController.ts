import { Request, Response, NextFunction } from 'express';
import { IAuditLogController } from '../interfaces/IAuditLogController';
import { IAuditLogService } from '../../services/interfaces/IAuditLogService';
import { successResponse } from '../../dtos/ApiResponse';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { MESSAGES } from '../../constants/messages';
import { auditLogQuerySchema } from '../../validators/auditLog.validator';

export class AuditLogController implements IAuditLogController {
  constructor(private readonly _auditLogService: IAuditLogService) {}

  async getAuditLogs(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const query = auditLogQuerySchema.parse(req.query);
      const result = await this._auditLogService.getAuditLogs(query);

      res.status(HTTP_STATUS.OK).json(
        successResponse(MESSAGES.AUDIT_LOGS_FETCHED, result.items, result.meta),
      );
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }

  async getAuditLogById(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const item = await this._auditLogService.getAuditLogById(id!);

      res.status(HTTP_STATUS.OK).json(
        successResponse(MESSAGES.AUDIT_LOG_FETCHED, item),
      );
    } catch (error) {
      if (next) return next(error);
      throw error;
    }
  }
}
