import { Request, Response } from 'express';
import { IAuditLogController } from '../interfaces/IAuditLogController';
import { IAuditLogService } from '../../services/interfaces/IAuditLogService';
import { successResponse } from '../../dtos/ApiResponse';
import { HTTP_STATUS } from '../../constants/httpStatus';
import { MESSAGES } from '../../constants/messages';
import { AuditLogQuery } from '../../validators/auditLog.validator';

export class AuditLogController implements IAuditLogController {
  constructor(private readonly auditLogService: IAuditLogService) {}

  async getAuditLogs(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as AuditLogQuery;
    const result = await this.auditLogService.getAuditLogs(query);

    res.status(HTTP_STATUS.OK).json(
      successResponse(MESSAGES.AUDIT_LOGS_FETCHED, result.items, result.meta),
    );
  }

  async getAuditLogById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const item = await this.auditLogService.getAuditLogById(id!);

    res.status(HTTP_STATUS.OK).json(
      successResponse(MESSAGES.AUDIT_LOG_FETCHED, item),
    );
  }
}
