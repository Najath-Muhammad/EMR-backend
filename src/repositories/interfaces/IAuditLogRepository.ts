import { IAuditLogDocument, IAuditLog } from '../../models/AuditLog.model';

export interface AuditLogFilter {
  action?: string;
  entityType?: string;
  status?: 'SUCCESS' | 'FAILURE';
  search?: string;
  startDate?: string;
  endDate?: string;
  actorUserId?: string;
}

export interface AuditLogPaginationOptions {
  page: number;
  limit: number;
  sortBy?: 'createdAt' | 'action' | 'entityType';
  sortOrder?: 'asc' | 'desc';
}

export interface IAuditLogRepository {
  create(data: Partial<IAuditLog>): Promise<IAuditLogDocument>;
  findPaginated(
    filter: AuditLogFilter,
    options: AuditLogPaginationOptions,
  ): Promise<{ items: IAuditLogDocument[]; total: number }>;
  findById(id: string): Promise<IAuditLogDocument | null>;
}
