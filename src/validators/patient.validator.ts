import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const emergencyContactSchema = z.object({
  name: z.string().min(2, 'Emergency contact name must be at least 2 characters').max(100),
  phone: z.string().min(7, 'Emergency contact phone must be at least 7 digits').max(20),
  relationship: z.string().max(50).optional(),
});

export const createPatientSchema = z.object({
  fullName: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters'),
  phone: z
    .string({ required_error: 'Mobile phone number is required' })
    .trim()
    .min(7, 'Phone number must be at least 7 digits')
    .max(20, 'Phone number cannot exceed 20 characters'),
  dateOfBirth: z
    .string({ required_error: 'Date of birth is required' })
    .regex(dateRegex, 'Date of birth must be in YYYY-MM-DD format')
    .refine((val) => {
      const dob = new Date(val);
      return !isNaN(dob.getTime()) && dob <= new Date();
    }, 'Date of birth cannot be in the future'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER'], {
    required_error: 'Gender is required',
  }),
  email: z.string().email('Invalid email address format').optional().or(z.literal('')),
  address: z.string().max(250, 'Address cannot exceed 250 characters').optional().or(z.literal('')),
  emergencyContact: emergencyContactSchema.optional(),
  bloodGroup: z
    .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'])
    .optional()
    .default('UNKNOWN'),
  registrationDepartment: z
    .string()
    .regex(objectIdRegex, 'Invalid department ID format')
    .optional()
    .or(z.literal('')),
});

export const updatePatientSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  dateOfBirth: z
    .string()
    .regex(dateRegex, 'Date of birth must be in YYYY-MM-DD format')
    .refine((val) => {
      const dob = new Date(val);
      return !isNaN(dob.getTime()) && dob <= new Date();
    }, 'Date of birth cannot be in the future')
    .optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(250).optional().or(z.literal('')),
  emergencyContact: emergencyContactSchema.optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN']).optional(),
  registrationDepartment: z
    .string()
    .regex(objectIdRegex, 'Invalid department ID format')
    .optional()
    .or(z.literal('')),
});

export const checkDuplicatesSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required for duplicate check'),
  phone: z.string().trim().min(1, 'Phone is required for duplicate check'),
  dateOfBirth: z.string().regex(dateRegex, 'Date of birth must be YYYY-MM-DD').optional().or(z.literal('')),
});

export const searchPatientsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  sortBy: z.enum(['fullName', 'patientId', 'createdAt', 'dateOfBirth']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type CheckDuplicatesInput = z.infer<typeof checkDuplicatesSchema>;
export type SearchPatientsQuery = z.infer<typeof searchPatientsQuerySchema>;
