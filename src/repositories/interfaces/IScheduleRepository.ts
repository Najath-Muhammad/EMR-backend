import { ScheduleDocument, ISchedule } from '../../models/Schedule.model';

export interface IScheduleRepository {
  findByDoctorId(doctorId: string): Promise<ScheduleDocument | null>;
  findById(id: string): Promise<ScheduleDocument | null>;
  upsertByDoctorId(doctorId: string, data: Partial<ISchedule>): Promise<ScheduleDocument>;
  toggleActiveStatus(doctorId: string, isActive: boolean): Promise<ScheduleDocument | null>;
}
