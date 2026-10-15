import { AppointmentStatus } from '../models/Appointment.model';

export interface PatientRefDto {
  id: string;
  patientId: string;
  fullName: string;
  phone: string;
  dateOfBirth?: string;
  gender?: string;
}

export interface DoctorRefDto {
  id: string;
  name: string;
  email: string;
  specialization?: string;
}

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

export interface RescheduleHistoryDto {
  previousDate: string;
  previousStartTime: string;
  previousEndTime: string;
  rescheduledAt: string;
  rescheduledBy?: StaffRefDto | null;
  reason?: string;
}

export interface AppointmentResponseDto {
  id: string;
  patient: PatientRefDto;
  doctor: DoctorRefDto;
  department: DepartmentRefDto;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  purpose: string;
  notes: string;
  createdBy: StaffRefDto | null;
  arrivedAt: string | null;
  arrivedBy: StaffRefDto | null;
  completedAt: string | null;
  completedBy: StaffRefDto | null;
  consultationNotes: string;
  cancelledAt: string | null;
  cancelledBy: StaffRefDto | null;
  cancellationReason: string;
  rescheduleHistory: RescheduleHistoryDto[];
  createdAt: string;
  updatedAt: string;
}
