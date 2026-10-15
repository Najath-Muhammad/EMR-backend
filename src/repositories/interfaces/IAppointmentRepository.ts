import { AppointmentDocument, IAppointment } from '../../models/Appointment.model';

export interface AppointmentFilter {
  doctor?: string;
  patient?: string;
  department?: string;
  date?: string | { $gte?: string; $lte?: string };
  status?: string;
}

export interface PaginatedAppointmentsResult {
  appointments: AppointmentDocument[];
  total: number;
  totalPages: number;
}

export interface IAppointmentRepository {
  create(data: Partial<IAppointment>): Promise<AppointmentDocument>;
  findById(id: string): Promise<AppointmentDocument | null>;
  findByDoctorAndDate(doctorId: string, date: string): Promise<AppointmentDocument[]>;
  findActiveFutureByDoctor(doctorId: string, fromDate: string): Promise<AppointmentDocument[]>;
  findPaginated(
    filter: AppointmentFilter,
    page: number,
    limit: number,
    sort?: Record<string, 1 | -1>,
  ): Promise<PaginatedAppointmentsResult>;
  update(id: string, updateData: Partial<IAppointment>): Promise<AppointmentDocument | null>;
}
