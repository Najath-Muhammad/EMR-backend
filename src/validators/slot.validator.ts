import { z } from 'zod';
import { saveScheduleSchema } from './schedule.validator';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const getSlotsQuerySchema = z.object({
  doctorId: z.string().regex(objectIdRegex, 'Invalid doctor ID format'),
  date: z.string().regex(dateRegex, 'date must be in YYYY-MM-DD format'),
  timezone: z.string().optional(),
});

export const previewSlotsSchema = z.object({
  schedule: saveScheduleSchema,
  date: z.string().regex(dateRegex, 'date must be in YYYY-MM-DD format'),
  timezone: z.string().optional(),
});

export type GetSlotsQueryInput = z.infer<typeof getSlotsQuerySchema>;
export type PreviewSlotsInput = z.infer<typeof previewSlotsSchema>;
