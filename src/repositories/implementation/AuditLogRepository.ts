import { Types, FilterQuery } from 'mongoose';
import {
  IAuditLogRepository,
  AuditLogFilter,
  AuditLogPaginationOptions,
} from '../interfaces/IAuditLogRepository';
import {
  AuditLogModel,
  IAuditLogDocument,
  IAuditLog,
} from '../../models/AuditLog.model';

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export class AuditLogRepository implements IAuditLogRepository {
  async create(data: Partial<IAuditLog>): Promise<IAuditLogDocument> {
    const created = await AuditLogModel.create(data);
    return created;
  }

  async findById(id: string): Promise<IAuditLogDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return AuditLogModel.findById(id).lean().exec() as unknown as IAuditLogDocument | null;
  }

  async findPaginated(
    filter: AuditLogFilter,
    options: AuditLogPaginationOptions,
  ): Promise<{ items: IAuditLogDocument[]; total: number }> {
    const query: FilterQuery<IAuditLogDocument> = {};

    if (filter.action) {
      query.action = filter.action.trim();
    }

    if (filter.entityType) {
      query.entityType = filter.entityType.trim();
    }

    if (filter.status) {
      query.status = filter.status;
    }

    if (filter.actorUserId && Types.ObjectId.isValid(filter.actorUserId)) {
      query['actor.userId'] = new Types.ObjectId(filter.actorUserId);
    }

    // Date range filtering on createdAt
    if (filter.startDate || filter.endDate) {
      query.createdAt = {};
      if (filter.startDate) {
        const start = new Date(filter.startDate);
        if (!isNaN(start.getTime())) {
          start.setUTCHours(0, 0, 0, 0);
          query.createdAt.$gte = start;
        }
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate);
        if (!isNaN(end.getTime())) {
          end.setUTCHours(23, 59, 59, 999);
          query.createdAt.$lte = end;
        }
      }
    }

    // Free text search
    if (filter.search && filter.search.trim().length > 0) {
      const escaped = escapeRegex(filter.search.trim());
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { action: regex },
        { entityType: regex },
        { entityId: regex },
        { 'actor.name': regex },
        { 'actor.email': regex },
        { 'actor.role': regex },
      ];
    }

    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      AuditLogModel.find(query)
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      AuditLogModel.countDocuments(query).exec(),
    ]);

    return {
      items: items as unknown as IAuditLogDocument[],
      total,
    };
  }
}
