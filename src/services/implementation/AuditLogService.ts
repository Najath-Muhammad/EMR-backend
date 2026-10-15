import { Types } from 'mongoose';
import { IAuditLogService, CreateAuditLogInput } from '../interfaces/IAuditLogService';
import { IAuditLogRepository } from '../../repositories/interfaces/IAuditLogRepository';
import { AuditLogResponseDto } from '../../dtos/auditLog.dto';
import { PaginatedResult } from '../../dtos/pagination.dto';
import { AuditLogQuery } from '../../validators/auditLog.validator';
import { AuditLogMapper } from '../../mappers/auditLog.mapper';
import { NotFoundError } from '../../errors/AppError';
import { MESSAGES } from '../../constants/messages';
import { logger } from '../../utils/logger';

export class AuditLogService implements IAuditLogService {
  constructor(private readonly auditLogRepo: IAuditLogRepository) {}

  async log(entry: CreateAuditLogInput): Promise<void> {
    try {
      let actorDoc;
      if (entry.actor) {
        actorDoc = {
          userId: entry.actor.userId && Types.ObjectId.isValid(entry.actor.userId)
            ? new Types.ObjectId(entry.actor.userId)
            : undefined,
          email: entry.actor.email,
          name: entry.actor.name,
          role: entry.actor.role,
        };
      }

      await this.auditLogRepo.create({
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        actor: actorDoc,
        details: entry.details,
        status: entry.status || 'SUCCESS',
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      });
    } catch (error) {
      logger.error('Failed to write audit log entry', {
        action: entry.action,
        entityType: entry.entityType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getAuditLogs(query: AuditLogQuery): Promise<PaginatedResult<AuditLogResponseDto>> {
    const filter = {
      action: query.action,
      entityType: query.entityType,
      status: query.status,
      search: query.search,
      startDate: query.startDate,
      endDate: query.endDate,
    };

    const options = {
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    const { items, total } = await this.auditLogRepo.findPaginated(filter, options);

    return {
      items: items.map((item) => AuditLogMapper.toResponseDto(item)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async getAuditLogById(id: string): Promise<AuditLogResponseDto> {
    const item = await this.auditLogRepo.findById(id);
    if (!item) {
      throw new NotFoundError(MESSAGES.AUDIT_LOG_NOT_FOUND);
    }
    return AuditLogMapper.toResponseDto(item);
  }
}
