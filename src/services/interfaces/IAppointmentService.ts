import {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  RescheduleAppointmentInput,
  AppointmentQuery,
} from '../../validators/appointment.validator';
import { AppointmentResponseDto } from '../../dtos/appointment.dto';

export interface RequestingUserContext {
  userId: string;
  role: string;
}

export interface PaginatedAppointmentResponseDto {
  appointments: AppointmentResponseDto[];
  total: number;
  totalPages: number;
}

export interface IAppointmentService {
  bookAppointment(
    input: CreateAppointmentInput,
    creatorUserId: string,
  ): Promise<AppointmentResponseDto>;

  cancelAppointment(
    id: string,
    staffUserId: string,
    reason?: string,
  ): Promise<AppointmentResponseDto>;

  markAsArrived(
    id: string,
    staffUserId: string,
  ): Promise<AppointmentResponseDto>;

  completeAppointment(
    id: string,
    requestingUser: RequestingUserContext,
    consultationNotes?: string,
  ): Promise<AppointmentResponseDto>;

  updateAppointment(
    id: string,
    requestingUser: RequestingUserContext,
    input: UpdateAppointmentInput,
  ): Promise<AppointmentResponseDto>;

  updateConsultationNotes(
    id: string,
    requestingUser: RequestingUserContext,
    notes: string,
  ): Promise<AppointmentResponseDto>;

  rescheduleAppointment(
    id: string,
    requestingUser: RequestingUserContext,
    input: RescheduleAppointmentInput,
  ): Promise<AppointmentResponseDto>;

  getAppointmentById(
    id: string,
    requestingUser: RequestingUserContext,
  ): Promise<AppointmentResponseDto>;

  getAppointments(
    query: AppointmentQuery,
    requestingUser: RequestingUserContext,
  ): Promise<PaginatedAppointmentResponseDto>;
}
