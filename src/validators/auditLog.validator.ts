import { z } from 'zod';

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  status: z.enum(['SUCCESS', 'FAILURE']).optional(),
  search: z.string().trim().max(100).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid start date format').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid end date format').optional(),
  sortBy: z.enum(['createdAt', 'action', 'entityType']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
