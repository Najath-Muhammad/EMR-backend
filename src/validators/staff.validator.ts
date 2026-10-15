import { z } from 'zod';
import { ROLES } from '../constants/roles';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createStaffSchema = z.object({
  name: z
    .string({ required_error: 'Staff name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address'),
  role: z.enum([ROLES.DOCTOR, ROLES.RECEPTIONIST], {
    required_error: 'Role must be either DOCTOR or RECEPTIONIST',
  }),
  department: z
    .string({ required_error: 'Department is required' })
    .trim()
    .regex(objectIdRegex, 'Invalid department ID format'),
  phone: z.string().trim().max(20, 'Phone cannot exceed 20 characters').optional().default(''),
  specialization: z.string().trim().max(100, 'Specialization cannot exceed 100 characters').optional().default(''),
});

export const updateStaffSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  department: z.string().trim().regex(objectIdRegex, 'Invalid department ID format').optional(),
  phone: z.string().trim().max(20).optional(),
  specialization: z.string().trim().max(100).optional(),
});

export const toggleStaffStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive boolean flag is required' }),
});

export const activateAccountSchema = z.object({
  token: z.string({ required_error: 'Activation token is required' }).min(10, 'Invalid activation token'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password cannot exceed 100 characters'),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type ToggleStaffStatusInput = z.infer<typeof toggleStaffStatusSchema>;
export type ActivateAccountInput = z.infer<typeof activateAccountSchema>;
