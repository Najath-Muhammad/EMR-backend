import { AuditLogResponseDto } from '../../dtos/auditLog.dto';
import { PaginatedResult } from '../../dtos/pagination.dto';
import { AuditLogQuery } from '../../validators/auditLog.validator';

export interface CreateAuditLogInput {
  action: string;
  entityType: string;
  entityId?: string;
  actor?: {
    userId?: string;
    email?: string;
    name?: string;
    role?: string;
  };
  details?: Record<string, unknown>;
  status?: 'SUCCESS' | 'FAILURE';
  ipAddress?: string;
  userAgent?: string;
}

export interface IAuditLogService {
  log(entry: CreateAuditLogInput): Promise<void>;
  getAuditLogs(query: AuditLogQuery): Promise<PaginatedResult<AuditLogResponseDto>>;
  getAuditLogById(id: string): Promise<AuditLogResponseDto>;
}
