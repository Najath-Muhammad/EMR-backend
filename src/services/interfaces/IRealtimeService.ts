import { AppointmentResponseDto } from '../../dtos/appointment.dto';

export type RealtimeAppointmentAction =
  | 'CREATED'
  | 'UPDATED'
  | 'RESCHEDULED'
  | 'STATUS_CHANGED'
  | 'CANCELLED';

export interface AppointmentRealtimePayload {
  action: RealtimeAppointmentAction;
  appointment: AppointmentResponseDto;
  departmentId: string;
  doctorId: string;
  timestamp: string;
}

export interface IRealtimeService {
  emitAppointmentCreated(appointment: AppointmentResponseDto): void;
  emitAppointmentUpdated(
    appointment: AppointmentResponseDto,
    action?: RealtimeAppointmentAction,
  ): void;
  emitAppointmentCancelled(appointment: AppointmentResponseDto): void;
}
