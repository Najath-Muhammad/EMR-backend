import { IScheduleRepository } from '../interfaces/IScheduleRepository';
import { ScheduleModel, ScheduleDocument, ISchedule } from '../../models/Schedule.model';

export class ScheduleRepository implements IScheduleRepository {
  async findByDoctorId(doctorId: string): Promise<ScheduleDocument | null> {
    return ScheduleModel.findOne({ doctor: doctorId }).populate({
      path: 'doctor',
      populate: {
        path: 'department',
        select: 'name code',
      },
    });
  }

  async findById(id: string): Promise<ScheduleDocument | null> {
    return ScheduleModel.findById(id).populate({
      path: 'doctor',
      populate: {
        path: 'department',
        select: 'name code',
      },
    });
  }

  async upsertByDoctorId(
    doctorId: string,
    data: Partial<ISchedule>,
  ): Promise<ScheduleDocument> {
    const updated = await ScheduleModel.findOneAndUpdate(
      { doctor: doctorId },
      {
        $set: {
          ...data,
          doctor: doctorId,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).populate({
      path: 'doctor',
      populate: {
        path: 'department',
        select: 'name code',
      },
    });

    return updated;
  }

  async toggleActiveStatus(
    doctorId: string,
    isActive: boolean,
  ): Promise<ScheduleDocument | null> {
    return ScheduleModel.findOneAndUpdate(
      { doctor: doctorId },
      { $set: { isActive } },
      { new: true },
    ).populate({
      path: 'doctor',
      populate: {
        path: 'department',
        select: 'name code',
      },
    });
  }
}
