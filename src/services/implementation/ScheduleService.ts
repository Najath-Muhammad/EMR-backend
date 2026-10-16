import { IScheduleService } from '../interfaces/IScheduleService';
import { IScheduleRepository } from '../../repositories/interfaces/IScheduleRepository';
import { IStaffRepository } from '../../repositories/interfaces/IStaffRepository';
import { IAppointmentRepository } from '../../repositories/interfaces/IAppointmentRepository';
import { ScheduleResponseDto, ScheduleConflictDto } from '../../dtos/schedule.dto';
import { SaveScheduleInput, timeToMinutes } from '../../validators/schedule.validator';
import { ScheduleMapper } from '../../mappers/schedule.mapper';
import { NotFoundError, BadRequestError, ConflictError } from '../../errors/AppError';
import { MESSAGES } from '../../constants/messages';
import { ROLES } from '../../constants/roles';
import { IAuditLogService } from '../interfaces/IAuditLogService';

export class ScheduleService implements IScheduleService {
  constructor(
    private readonly _scheduleRepo: IScheduleRepository,
    private readonly _staffRepo: IStaffRepository,
    private readonly _appointmentRepo: IAppointmentRepository,
    private readonly _auditLogService?: IAuditLogService,
  ) {}

  async getDoctorSchedule(doctorId: string): Promise<ScheduleResponseDto> {
    try {
      const doctor = await this._staffRepo.findById(doctorId);
      if (!doctor || doctor.role !== ROLES.DOCTOR) {
        throw new NotFoundError(MESSAGES.SCHEDULE_DOCTOR_NOT_FOUND);
      }

      const schedule = await this._scheduleRepo.findByDoctorId(doctorId);
      if (!schedule) {
        throw new NotFoundError(MESSAGES.SCHEDULE_NOT_FOUND);
      }

      return ScheduleMapper.toResponseDto(schedule);
    } catch (error) {
      throw error;
    }
  }

  async saveDoctorSchedule(
    doctorId: string,
    input: SaveScheduleInput,
    force = false,
  ): Promise<ScheduleResponseDto> {
    try {
      const doctor = await this._staffRepo.findById(doctorId);
      if (!doctor || doctor.role !== ROLES.DOCTOR) {
        throw new NotFoundError(MESSAGES.SCHEDULE_DOCTOR_NOT_FOUND);
      }

      if (!doctor.isActive) {
        throw new BadRequestError(MESSAGES.SCHEDULE_DOCTOR_INACTIVE);
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const futureAppointments = await this._appointmentRepo.findActiveFutureByDoctor(
        doctorId,
        todayStr,
      );

      if (futureAppointments.length > 0) {
        const conflicts: ScheduleConflictDto[] = [];

        for (const app of futureAppointments) {
          const appDate = new Date(`${app.date}T00:00:00Z`);
          const dayOfWeek = appDate.getUTCDay();

          const configuredDay = input.workingDays.find((d) => d.dayOfWeek === dayOfWeek);

          if (!configuredDay || !configuredDay.isEnabled) {
            conflicts.push({
              appointmentId: app._id.toString(),
              patientName: app.patientName,
              date: app.date,
              startTime: app.startTime,
              endTime: app.endTime,
              reason: `Day ${configuredDay?.dayName ?? dayOfWeek} is not enabled in the new schedule`,
            });
            continue;
          }

          const appStartMin = timeToMinutes(app.startTime);
          const appEndMin = timeToMinutes(app.endTime);

          const fitsInSession = configuredDay.sessions.some((session) => {
            const sessionStart = timeToMinutes(session.startTime);
            const sessionEnd = timeToMinutes(session.endTime);
            return appStartMin >= sessionStart && appEndMin <= sessionEnd;
          });

          if (!fitsInSession) {
            conflicts.push({
              appointmentId: app._id.toString(),
              patientName: app.patientName,
              date: app.date,
              startTime: app.startTime,
              endTime: app.endTime,
              reason: `Appointment time ${app.startTime}-${app.endTime} falls outside scheduled sessions`,
            });
            continue;
          }

          const overlapsBreak = configuredDay.breaks.some((brk) => {
            const breakStart = timeToMinutes(brk.startTime);
            const breakEnd = timeToMinutes(brk.endTime);
            return appStartMin < breakEnd && appEndMin > breakStart;
          });

          if (overlapsBreak) {
            conflicts.push({
              appointmentId: app._id.toString(),
              patientName: app.patientName,
              date: app.date,
              startTime: app.startTime,
              endTime: app.endTime,
              reason: `Appointment time ${app.startTime}-${app.endTime} conflicts with a scheduled break`,
            });
          }
        }

        if (conflicts.length > 0 && !force) {
          const conflictDetails = conflicts
            .map((c) => `[${c.date} ${c.startTime}-${c.endTime}: ${c.reason}]`)
            .join('; ');
          throw new ConflictError(
            `${MESSAGES.SCHEDULE_CONFLICT_DETECTED}: ${conflictDetails}`,
          );
        }
      }

      const saved = await this._scheduleRepo.upsertByDoctorId(doctorId, {
        slotDuration: input.slotDuration,
        workingDays: input.workingDays,
        isActive: input.isActive,
      });

      void this._auditLogService?.log({
        action: 'SCHEDULE_UPDATE',
        entityType: 'Schedule',
        entityId: saved._id ? saved._id.toString() : undefined,
        details: {
          doctorId,
          slotDuration: input.slotDuration,
          isActive: input.isActive,
        },
      });

      return ScheduleMapper.toResponseDto(saved);
    } catch (error) {
      throw error;
    }
  }

  async toggleDoctorScheduleStatus(
    doctorId: string,
    isActive: boolean,
  ): Promise<ScheduleResponseDto> {
    try {
      const doctor = await this._staffRepo.findById(doctorId);
      if (!doctor || doctor.role !== ROLES.DOCTOR) {
        throw new NotFoundError(MESSAGES.SCHEDULE_DOCTOR_NOT_FOUND);
      }

      const updated = await this._scheduleRepo.toggleActiveStatus(doctorId, isActive);
      if (!updated) {
        throw new NotFoundError(MESSAGES.SCHEDULE_NOT_FOUND);
      }

      return ScheduleMapper.toResponseDto(updated);
    } catch (error) {
      throw error;
    }
  }
}
