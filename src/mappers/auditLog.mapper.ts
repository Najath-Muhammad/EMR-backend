import { IAuditLogDocument } from '../models/AuditLog.model';
import { AuditLogResponseDto, AuditActorDto } from '../dtos/auditLog.dto';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'refreshtoken',
  'rawrefreshtoken',
  'activationtoken',
  'tokenhash',
  'secret',
  'accesstoken',
]);

function sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details || typeof details !== 'object') return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class AuditLogMapper {
  static toResponseDto(doc: IAuditLogDocument): AuditLogResponseDto {
    let actorDto: AuditActorDto | undefined = undefined;
    if (doc.actor) {
      actorDto = {
        userId: doc.actor.userId ? doc.actor.userId.toString() : undefined,
        email: doc.actor.email,
        name: doc.actor.name,
        role: doc.actor.role,
      };
    }

    return {
      id: doc._id.toString(),
      action: doc.action,
      entityType: doc.entityType,
      entityId: doc.entityId,
      actor: actorDto,
      details: sanitizeDetails(doc.details),
      status: doc.status || 'SUCCESS',
      ipAddress: doc.ipAddress,
      userAgent: doc.userAgent,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date(doc.createdAt).toISOString(),
    };
  }
}
