import { z } from 'zod';

const timeRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createAppointmentSchema = z
  .object({
    patientId: z
      .string({ required_error: 'Patient ID is required' })
      .regex(objectIdRegex, 'Invalid patient ID format'),
    doctorId: z
      .string({ required_error: 'Doctor ID is required' })
      .regex(objectIdRegex, 'Invalid doctor ID format'),
    departmentId: z
      .string()
      .regex(objectIdRegex, 'Invalid department ID format')
      .optional(),
    date: z
      .string({ required_error: 'Date is required' })
      .regex(dateRegex, 'Date must be in YYYY-MM-DD format'),
    startTime: z
      .string({ required_error: 'Start time is required' })
      .regex(timeRegex, 'Start time must be in HH:mm format (e.g. 09:30)'),
    endTime: z
      .string({ required_error: 'End time is required' })
      .regex(timeRegex, 'End time must be in HH:mm format (e.g. 10:00)'),
    purpose: z
      .string({ required_error: 'Appointment purpose is required' })
      .trim()
      .min(2, 'Purpose must be at least 2 characters')
      .max(500, 'Purpose cannot exceed 500 characters'),
    notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional().default(''),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: 'End time must be strictly after start time',
    path: ['endTime'],
  });

export const updateAppointmentSchema = z
  .object({
    purpose: z
      .string()
      .trim()
      .min(2, 'Purpose must be at least 2 characters')
      .max(500, 'Purpose cannot exceed 500 characters')
      .optional(),
    notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional(),
  })
  .refine((data) => data.purpose !== undefined || data.notes !== undefined, {
    message: 'At least one field (purpose or notes) must be provided for update',
  });

export const completeAppointmentSchema = z.object({
  consultationNotes: z
    .string()
    .trim()
    .max(2000, 'Consultation notes cannot exceed 2000 characters')
    .optional()
    .default(''),
});

export const updateConsultationNotesSchema = z.object({
  consultationNotes: z
    .string({ required_error: 'Consultation notes are required' })
    .trim()
    .max(2000, 'Consultation notes cannot exceed 2000 characters'),
});

export const rescheduleAppointmentSchema = z
  .object({
    date: z
      .string({ required_error: 'New appointment date is required' })
      .regex(dateRegex, 'Date must be in YYYY-MM-DD format'),
    startTime: z
      .string({ required_error: 'New start time is required' })
      .regex(timeRegex, 'Start time must be in HH:mm format (e.g. 09:30)'),
    endTime: z
      .string({ required_error: 'New end time is required' })
      .regex(timeRegex, 'End time must be in HH:mm format (e.g. 10:00)'),
    reason: z.string().trim().max(500, 'Reason cannot exceed 500 characters').optional().default(''),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: 'End time must be strictly after start time',
    path: ['endTime'],
  });

export const cancelAppointmentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(2, 'Cancellation reason must be at least 2 characters')
    .max(500, 'Cancellation reason cannot exceed 500 characters')
    .optional()
    .or(z.literal('')),
});

export const appointmentQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(15),
    search: z.string().trim().max(100, 'Search term cannot exceed 100 characters').optional(),
    doctorId: z.string().regex(objectIdRegex, 'Invalid doctor ID format').optional(),
    patientId: z.string().regex(objectIdRegex, 'Invalid patient ID format').optional(),
    departmentId: z.string().regex(objectIdRegex, 'Invalid department ID format').optional(),
    date: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD').optional(),
    status: z
      .enum(['SCHEDULED', 'CONFIRMED', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
      .optional(),
    startDate: z.string().regex(dateRegex, 'Start date must be YYYY-MM-DD').optional(),
    endDate: z.string().regex(dateRegex, 'End date must be YYYY-MM-DD').optional(),
    fromDate: z.string().regex(dateRegex, 'From date must be YYYY-MM-DD').optional(),
    toDate: z.string().regex(dateRegex, 'To date must be YYYY-MM-DD').optional(),
    sortBy: z.enum(['date', 'startTime', 'createdAt', 'status']).default('date'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })
  .refine(
    (data) => {
      const start = data.startDate || data.fromDate;
      const end = data.endDate || data.toDate;
      if (start && end) {
        return start <= end;
      }
      return true;
    },
    {
      message: 'Start date must be on or before end date',
      path: ['endDate'],
    },
  );

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type CompleteAppointmentInput = z.infer<typeof completeAppointmentSchema>;
export type UpdateConsultationNotesInput = z.infer<typeof updateConsultationNotesSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;
export type AppointmentQuery = z.infer<typeof appointmentQuerySchema>;
