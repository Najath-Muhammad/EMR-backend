import { CreateAppointmentInput, AppointmentQuery } from '../../validators/appointment.validator';
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

  getAppointmentById(
    id: string,
    requestingUser: RequestingUserContext,
  ): Promise<AppointmentResponseDto>;

  getAppointments(
    query: AppointmentQuery,
    requestingUser: RequestingUserContext,
  ): Promise<PaginatedAppointmentResponseDto>;
}
