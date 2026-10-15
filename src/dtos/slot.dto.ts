export type SlotUnavailableReason =
  | 'PAST_TIME'
  | 'BOOKED'
  | 'BREAK'
  | 'OUTSIDE_SESSION';

export interface SlotResponseDto {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  date: string;      // YYYY-MM-DD
  isAvailable: boolean;
  reason?: SlotUnavailableReason;
  slotDuration: number;
}

export interface SlotDoctorRefDto {
  id: string;
  name: string;
  specialization?: string;
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface DaySlotsResultDto {
  doctor: SlotDoctorRefDto;
  date: string;
  dayOfWeek: string;
  slotDuration: number;
  totalSlots: number;
  availableSlots: number;
  slots: SlotResponseDto[];
}
