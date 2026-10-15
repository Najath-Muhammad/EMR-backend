import { IScheduleRepository } from '../interfaces/IScheduleRepository';
import { ScheduleModel, ScheduleDocument, ISchedule } from '../../models/Schedule.model';
import { logger } from '../../utils/logger';

export class ScheduleRepository implements IScheduleRepository {
  async findByDoctorId(doctorId: string): Promise<ScheduleDocument | null> {
    try {
      return await ScheduleModel.findOne({ doctor: doctorId }).populate({
        path: 'doctor',
        populate: {
          path: 'department',
          select: 'name code',
        },
      });
    } catch (error) {
      logger.error('Database error in ScheduleRepository.findByDoctorId:', {
        doctorId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findById(id: string): Promise<ScheduleDocument | null> {
    try {
      return await ScheduleModel.findById(id).populate({
        path: 'doctor',
        populate: {
          path: 'department',
          select: 'name code',
        },
      });
    } catch (error) {
      logger.error('Database error in ScheduleRepository.findById:', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async upsertByDoctorId(
    doctorId: string,
    data: Partial<ISchedule>,
  ): Promise<ScheduleDocument> {
    try {
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
    } catch (error) {
      logger.error('Database error in ScheduleRepository.upsertByDoctorId:', {
        doctorId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async toggleActiveStatus(
    doctorId: string,
    isActive: boolean,
  ): Promise<ScheduleDocument | null> {
    try {
      return await ScheduleModel.findOneAndUpdate(
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
    } catch (error) {
      logger.error('Database error in ScheduleRepository.toggleActiveStatus:', {
        doctorId,
        isActive,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
