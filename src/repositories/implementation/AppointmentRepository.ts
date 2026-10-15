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

export class AppointmentRepository implements IAppointmentRepository {
  async create(data: Partial<IAppointment>): Promise<AppointmentDocument> {
    const doc = await AppointmentModel.create(data);
    return this.findById(doc._id.toString()) as Promise<AppointmentDocument>;
  }

  async findById(id: string): Promise<AppointmentDocument | null> {
    return AppointmentModel.findById(id)
      .populate('patient')
      .populate('doctor', 'name email specialization department')
      .populate('department', 'name code')
      .populate('createdBy', 'name email')
      .populate('cancelledBy', 'name email');
  }

  async findByDoctorAndDate(
    doctorId: string,
    date: string,
  ): Promise<AppointmentDocument[]> {
    return AppointmentModel.find({
      doctor: doctorId,
      date,
      status: { $in: ['SCHEDULED', 'CONFIRMED', 'PENDING'] },
    }).sort({ startTime: 1 });
  }

  async findActiveFutureByDoctor(
    doctorId: string,
    fromDate: string,
  ): Promise<AppointmentDocument[]> {
    return AppointmentModel.find({
      doctor: doctorId,
      date: { $gte: fromDate },
      status: { $in: ['SCHEDULED', 'CONFIRMED', 'PENDING'] },
    }).sort({ date: 1, startTime: 1 });
  }

  async findPaginated(
    filter: AppointmentFilter,
    page: number,
    limit: number,
    sort: Record<string, 1 | -1> = { date: 1, startTime: 1 },
  ): Promise<PaginatedAppointmentsResult> {
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
        .populate('cancelledBy', 'name email'),
      AppointmentModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      appointments,
      total,
      totalPages,
    };
  }

  async update(
    id: string,
    updateData: Partial<IAppointment>,
  ): Promise<AppointmentDocument | null> {
    return AppointmentModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    )
      .populate('patient')
      .populate('doctor', 'name email specialization department')
      .populate('department', 'name code')
      .populate('createdBy', 'name email')
      .populate('cancelledBy', 'name email');
  }
}
