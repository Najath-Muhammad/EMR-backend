import { Gender, BloodGroup, EmergencyContact } from '../models/Patient.model';

export interface DepartmentRefDto {
  id: string;
  name: string;
  code: string;
}

export interface StaffRefDto {
  id: string;
  name: string;
  email: string;
}

export interface PatientResponseDto {
  id: string;
  patientId: string;
  fullName: string;
  phone: string;
  normalizedPhone: string;
  dateOfBirth: string;
  gender: Gender;
  email?: string;
  address?: string;
  emergencyContact?: EmergencyContact;
  bloodGroup: BloodGroup;
  registrationDepartment?: DepartmentRefDto | null;
  registeredBy?: StaffRefDto | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DuplicateMatchReason =
  | 'MATCHING_PHONE'
  | 'MATCHING_NAME_AND_DOB'
  | 'MATCHING_NAME_ONLY';

export interface PossibleDuplicateDto {
  patient: PatientResponseDto;
  matchReasons: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface DuplicateCheckResponseDto {
  hasMatches: boolean;
  duplicates: PossibleDuplicateDto[];
}
