export interface SessionDto {
  startTime: string;
  endTime: string;
  label?: string;
}

export interface BreakDto {
  startTime: string;
  endTime: string;
  label?: string;
}

export interface DayScheduleDto {
  dayOfWeek: number;
  dayName: string;
  isEnabled: boolean;
  sessions: SessionDto[];
  breaks: BreakDto[];
}

export interface ScheduleDoctorSummaryDto {
  id: string;
  name: string;
  email: string;
  specialization?: string;
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface ScheduleResponseDto {
  id: string;
  doctor: ScheduleDoctorSummaryDto;
  slotDuration: number;
  workingDays: DayScheduleDto[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleConflictDto {
  appointmentId: string;
  patientName?: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
}
