import { z } from 'zod';
import { ROLES } from '../constants/roles';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  sortBy: z.string().trim().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  isActive: z.enum(['true', 'false', 'all']).optional(),
  role: z.enum([ROLES.DOCTOR, ROLES.RECEPTIONIST]).optional(),
  department: z.string().trim().optional(),
});

export type PaginationQueryInput = z.infer<typeof paginationSchema>;
