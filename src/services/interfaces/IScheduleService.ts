import { ScheduleResponseDto } from '../../dtos/schedule.dto';
import { SaveScheduleInput } from '../../validators/schedule.validator';

export interface IScheduleService {
  getDoctorSchedule(doctorId: string): Promise<ScheduleResponseDto>;
  saveDoctorSchedule(
    doctorId: string,
    input: SaveScheduleInput,
    force?: boolean,
  ): Promise<ScheduleResponseDto>;
  toggleDoctorScheduleStatus(doctorId: string, isActive: boolean): Promise<ScheduleResponseDto>;
}
