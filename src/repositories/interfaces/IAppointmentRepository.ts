import { AppointmentDocument } from '../../models/Appointment.model';

export interface IAppointmentRepository {
  findActiveFutureByDoctor(doctorId: string, fromDate: string): Promise<AppointmentDocument[]>;
  findByDoctorAndDate(doctorId: string, date: string): Promise<AppointmentDocument[]>;
}
