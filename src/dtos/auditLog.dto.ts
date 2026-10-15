export interface AuditActorDto {
  userId?: string;
  email?: string;
  name?: string;
  role?: string;
}

export interface AuditLogResponseDto {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  actor?: AuditActorDto;
  details?: Record<string, unknown>;
  status: 'SUCCESS' | 'FAILURE';
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}
