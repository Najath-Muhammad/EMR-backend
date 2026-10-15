import { ISlotService } from '../interfaces/ISlotService';
import { IScheduleRepository } from '../../repositories/interfaces/IScheduleRepository';
import { IStaffRepository } from '../../repositories/interfaces/IStaffRepository';
import { IAppointmentRepository } from '../../repositories/interfaces/IAppointmentRepository';
import { DaySlotsResultDto, SlotResponseDto, SlotUnavailableReason } from '../../dtos/slot.dto';
import { PreviewSlotsInput } from '../../validators/slot.validator';
import { timeToMinutes, minutesToTime, WorkingDayInput } from '../../validators/schedule.validator';
import { NotFoundError, BadRequestError } from '../../errors/AppError';
import { MESSAGES } from '../../constants/messages';
import { ROLES } from '../../constants/roles';
import { env } from '../../config/env';
import { DepartmentDocument } from '../../models/Department.model';

export class SlotService implements ISlotService {
  constructor(
    private readonly scheduleRepo: IScheduleRepository,
    private readonly staffRepo: IStaffRepository,
    private readonly appointmentRepo: IAppointmentRepository,
  ) {}

  async getSlots(
    doctorId: string,
    dateStr: string,
    timezone?: string,
  ): Promise<DaySlotsResultDto> {
    const tz = timezone || env.HOSPITAL_TIMEZONE || 'UTC';

    const doctor = await this.staffRepo.findById(doctorId);
    if (!doctor || doctor.role !== ROLES.DOCTOR) {
      throw new NotFoundError(MESSAGES.SCHEDULE_DOCTOR_NOT_FOUND);
    }

    if (!doctor.isActive) {
      throw new BadRequestError(MESSAGES.SCHEDULE_DOCTOR_INACTIVE);
    }

    const rawDept = doctor.department as unknown as DepartmentDocument;
    const departmentRef =
      rawDept && typeof rawDept === 'object' && 'name' in rawDept
        ? { id: rawDept._id.toString(), name: rawDept.name, code: rawDept.code }
        : null;

    const doctorRef = {
      id: doctor._id.toString(),
      name: doctor.name,
      specialization: doctor.specialization,
      department: departmentRef,
    };

    const schedule = await this.scheduleRepo.findByDoctorId(doctorId);
    if (!schedule || !schedule.isActive) {
      const { dayName } = this.getDayInfoForDate(dateStr, tz);
      return {
        doctor: doctorRef,
        date: dateStr,
        dayOfWeek: dayName,
        slotDuration: 15,
        totalSlots: 0,
        availableSlots: 0,
        slots: [],
      };
    }

    const { dayOfWeek, dayName } = this.getDayInfoForDate(dateStr, tz);
    const dayConfig = schedule.workingDays.find((d) => d.dayOfWeek === dayOfWeek);

    if (!dayConfig || !dayConfig.isEnabled) {
      return {
        doctor: doctorRef,
        date: dateStr,
        dayOfWeek: dayName,
        slotDuration: schedule.slotDuration,
        totalSlots: 0,
        availableSlots: 0,
        slots: [],
      };
    }

    // Active booked appointments on this date
    const bookedAppointments = await this.appointmentRepo.findByDoctorAndDate(doctorId, dateStr);
    const bookedRanges = bookedAppointments.map((app) => ({
      start: timeToMinutes(app.startTime),
      end: timeToMinutes(app.endTime),
    }));

    const slots = this.generateSlotsForDay(
      dayConfig as WorkingDayInput,
      schedule.slotDuration,
      dateStr,
      tz,
      bookedRanges,
    );

    return {
      doctor: doctorRef,
      date: dateStr,
      dayOfWeek: dayName,
      slotDuration: schedule.slotDuration,
      totalSlots: slots.length,
      availableSlots: slots.filter((s) => s.isAvailable).length,
      slots,
    };
  }

  async previewSlots(input: PreviewSlotsInput): Promise<DaySlotsResultDto> {
    const tz = input.timezone || env.HOSPITAL_TIMEZONE || 'UTC';
    const { dayOfWeek, dayName } = this.getDayInfoForDate(input.date, tz);

    const dayConfig = input.schedule.workingDays.find((d) => d.dayOfWeek === dayOfWeek);

    const doctorRef = {
      id: 'preview-doctor-id',
      name: 'Preview Doctor',
    };

    if (!input.schedule.isActive || !dayConfig || !dayConfig.isEnabled) {
      return {
        doctor: doctorRef,
        date: input.date,
        dayOfWeek: dayName,
        slotDuration: input.schedule.slotDuration,
        totalSlots: 0,
        availableSlots: 0,
        slots: [],
      };
    }

    const slots = this.generateSlotsForDay(
      dayConfig,
      input.schedule.slotDuration,
      input.date,
      tz,
      [], // no existing bookings in preview mode
    );

    return {
      doctor: doctorRef,
      date: input.date,
      dayOfWeek: dayName,
      slotDuration: input.schedule.slotDuration,
      totalSlots: slots.length,
      availableSlots: slots.filter((s) => s.isAvailable).length,
      slots,
    };
  }

  private generateSlotsForDay(
    dayConfig: WorkingDayInput,
    slotDuration: number,
    dateStr: string,
    tz: string,
    bookedRanges: Array<{ start: number; end: number }>,
  ): SlotResponseDto[] {
    const slots: SlotResponseDto[] = [];
    const { isPastDate, isToday, currentTimeMinutes } = this.getTimeComparison(dateStr, tz);

    // Sort sessions chronologically
    const sortedSessions = [...dayConfig.sessions].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
    );

    for (const session of sortedSessions) {
      let currentStartMin = timeToMinutes(session.startTime);
      const sessionEndMin = timeToMinutes(session.endTime);

      // Generate non-overlapping slots completely within session
      while (currentStartMin + slotDuration <= sessionEndMin) {
        const currentEndMin = currentStartMin + slotDuration;
        const slotStartStr = minutesToTime(currentStartMin);
        const slotEndStr = minutesToTime(currentEndMin);

        // Check if slot overlaps with ANY break on this day
        // Overlap: slotStart < breakEnd && slotEnd > breakStart
        const hitsBreak = dayConfig.breaks.some((brk) => {
          const breakStart = timeToMinutes(brk.startTime);
          const breakEnd = timeToMinutes(brk.endTime);
          return currentStartMin < breakEnd && currentEndMin > breakStart;
        });

        // Never generate slots during breaks
        if (!hitsBreak) {
          let isAvailable = true;
          let reason: SlotUnavailableReason | undefined = undefined;

          if (isPastDate) {
            isAvailable = false;
            reason = 'PAST_TIME';
          } else if (isToday && currentStartMin <= currentTimeMinutes) {
            isAvailable = false;
            reason = 'PAST_TIME';
          } else {
            // Check if slot overlaps an existing booking
            const isBooked = bookedRanges.some(
              (b) => currentStartMin < b.end && currentEndMin > b.start,
            );
            if (isBooked) {
              isAvailable = false;
              reason = 'BOOKED';
            }
          }

          slots.push({
            startTime: slotStartStr,
            endTime: slotEndStr,
            date: dateStr,
            isAvailable,
            reason,
            slotDuration,
          });
        }

        currentStartMin += slotDuration;
      }
    }

    return slots;
  }

  private getDayInfoForDate(
    dateStr: string,
    tz: string,
  ): { dayOfWeek: number; dayName: string } {
    const [year, month, day] = dateStr.split('-').map(Number);
    // Construct noon UTC date to avoid DST border issues
    const utcDate = new Date(Date.UTC(year!, month! - 1, day!, 12, 0, 0));

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
    });
    const weekdayName = formatter.format(utcDate).toUpperCase();

    const dayNameMap: Record<string, number> = {
      SUNDAY: 0,
      MONDAY: 1,
      TUESDAY: 2,
      WEDNESDAY: 3,
      THURSDAY: 4,
      FRIDAY: 5,
      SATURDAY: 6,
    };

    return {
      dayOfWeek: dayNameMap[weekdayName] ?? 0,
      dayName: weekdayName,
    };
  }

  private getTimeComparison(
    dateStr: string,
    tz: string,
  ): { isPastDate: boolean; isToday: boolean; currentTimeMinutes: number } {
    const now = new Date();

    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayStr = dateFormatter.format(now); // YYYY-MM-DD

    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const nowTimeStr = timeFormatter.format(now);
    const currentTimeMinutes = timeToMinutes(nowTimeStr);

    const isPastDate = dateStr < todayStr;
    const isToday = dateStr === todayStr;

    return {
      isPastDate,
      isToday,
      currentTimeMinutes,
    };
  }
}
