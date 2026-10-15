import {
  IAppointmentRepository,
  AppointmentFilter,
  PaginatedAppointmentsResult,
} from '../interfaces/IAppointmentRepository';
import {
  AppointmentModel,
  AppointmentDocument,
  IAppointment,
} from '../../models/Appointment.model';
import { logger } from '../../utils/logger';

export class AppointmentRepository implements IAppointmentRepository {
  async create(data: Partial<IAppointment>): Promise<AppointmentDocument> {
    try {
      const doc = await AppointmentModel.create(data);
      return (await this.findById(doc._id.toString())) as AppointmentDocument;
    } catch (error) {
      logger.error('Database error in AppointmentRepository.create:', {
        doctor: data.doctor,
        patient: data.patient,
        date: data.date,
        startTime: data.startTime,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findById(id: string): Promise<AppointmentDocument | null> {
    try {
      return await AppointmentModel.findById(id)
        .populate('patient')
        .populate('doctor', 'name email specialization department')
        .populate('department', 'name code')
        .populate('createdBy', 'name email')
        .populate('arrivedBy', 'name email')
        .populate('completedBy', 'name email')
        .populate('cancelledBy', 'name email')
        .populate('rescheduleHistory.rescheduledBy', 'name email');
    } catch (error) {
      logger.error('Database error in AppointmentRepository.findById:', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findByDoctorAndDate(
    doctorId: string,
    date: string,
  ): Promise<AppointmentDocument[]> {
    try {
      return await AppointmentModel.find({
        doctor: doctorId,
        date,
        status: { $in: ['SCHEDULED', 'CONFIRMED', 'ARRIVED', 'PENDING'] },
      }).sort({ startTime: 1 });
    } catch (error) {
      logger.error('Database error in AppointmentRepository.findByDoctorAndDate:', {
        doctorId,
        date,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findActiveFutureByDoctor(
    doctorId: string,
    fromDate: string,
  ): Promise<AppointmentDocument[]> {
    try {
      return await AppointmentModel.find({
        doctor: doctorId,
        date: { $gte: fromDate },
        status: { $in: ['SCHEDULED', 'CONFIRMED', 'ARRIVED', 'PENDING'] },
      }).sort({ date: 1, startTime: 1 });
    } catch (error) {
      logger.error('Database error in AppointmentRepository.findActiveFutureByDoctor:', {
        doctorId,
        fromDate,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findPaginated(
    filter: AppointmentFilter,
    page: number,
    limit: number,
    sort: Record<string, 1 | -1> = { date: 1, startTime: 1 },
  ): Promise<PaginatedAppointmentsResult> {
    try {
      const skip = (page - 1) * limit;

      const query: Record<string, unknown> = {};
      if (filter.doctor) query['doctor'] = filter.doctor;
      if (filter.patient) query['patient'] = filter.patient;
      if (filter.department) query['department'] = filter.department;
      if (filter.status) query['status'] = filter.status;
      if (filter.date) query['date'] = filter.date;

      const [appointments, total] = await Promise.all([
        AppointmentModel.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('patient')
          .populate('doctor', 'name email specialization department')
          .populate('department', 'name code')
          .populate('createdBy', 'name email')
          .populate('arrivedBy', 'name email')
          .populate('completedBy', 'name email')
          .populate('cancelledBy', 'name email')
          .populate('rescheduleHistory.rescheduledBy', 'name email'),
        AppointmentModel.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit) || 1;

      return {
        appointments,
        total,
        totalPages,
      };
    } catch (error) {
      logger.error('Database error in AppointmentRepository.findPaginated:', {
        filter,
        page,
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async update(
    id: string,
    updateData: Partial<IAppointment>,
  ): Promise<AppointmentDocument | null> {
    try {
      return await AppointmentModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true },
      )
        .populate('patient')
        .populate('doctor', 'name email specialization department')
        .populate('department', 'name code')
        .populate('createdBy', 'name email')
        .populate('arrivedBy', 'name email')
        .populate('completedBy', 'name email')
        .populate('cancelledBy', 'name email')
        .populate('rescheduleHistory.rescheduledBy', 'name email');
    } catch (error) {
      logger.error('Database error in AppointmentRepository.update:', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
