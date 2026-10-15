import { Role } from '../constants/roles';

export interface CreateStaffDto {
  name: string;
  email: string;
  role: 'DOCTOR' | 'RECEPTIONIST';
  department: string;
  phone?: string;
  specialization?: string;
}

export interface UpdateStaffDto {
  name?: string;
  department?: string;
  phone?: string;
  specialization?: string;
}

export interface DepartmentSummaryDto {
  id: string;
  name: string;
  code: string;
}

export interface StaffResponseDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: DepartmentSummaryDto | null;
  phone: string;
  specialization: string;
  isActive: boolean;
  isActivated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StaffCreationResultDto {
  staff: StaffResponseDto;
  activationLink: string;
}

export interface ActivateAccountDto {
  token: string;
  password: string;
}
