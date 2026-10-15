import { IAppointmentRepository } from '../interfaces/IAppointmentRepository';
import { AppointmentModel, AppointmentDocument } from '../../models/Appointment.model';

export class AppointmentRepository implements IAppointmentRepository {
  async findActiveFutureByDoctor(
    doctorId: string,
    fromDate: string,
  ): Promise<AppointmentDocument[]> {
    return AppointmentModel.find({
      doctor: doctorId,
      date: { $gte: fromDate },
      status: { $in: ['PENDING', 'CONFIRMED'] },
    }).sort({ date: 1, startTime: 1 });
  }

  async findByDoctorAndDate(
    doctorId: string,
    date: string,
  ): Promise<AppointmentDocument[]> {
    return AppointmentModel.find({
      doctor: doctorId,
      date,
      status: { $in: ['PENDING', 'CONFIRMED'] },
    }).sort({ startTime: 1 });
  }
}
