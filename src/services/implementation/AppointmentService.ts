import { Types } from 'mongoose';
import {
  IAppointmentService,
  PaginatedAppointmentResponseDto,
  RequestingUserContext,
} from '../interfaces/IAppointmentService';
import { IAppointmentRepository, AppointmentFilter } from '../../repositories/interfaces/IAppointmentRepository';
import { IPatientRepository } from '../../repositories/interfaces/IPatientRepository';
import { IStaffRepository } from '../../repositories/interfaces/IStaffRepository';
import { IDepartmentRepository } from '../../repositories/interfaces/IDepartmentRepository';
import { IScheduleRepository } from '../../repositories/interfaces/IScheduleRepository';
import {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  RescheduleAppointmentInput,
  AppointmentQuery,
} from '../../validators/appointment.validator';
import { AppointmentResponseDto } from '../../dtos/appointment.dto';
import { AppointmentMapper } from '../../mappers/appointment.mapper';
import { timeToMinutes } from '../../validators/schedule.validator';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from '../../errors/AppError';
import { MESSAGES } from '../../constants/messages';
import { ROLES } from '../../constants/roles';
import { env } from '../../config/env';

export class AppointmentService implements IAppointmentService {
  constructor(
    private readonly appointmentRepo: IAppointmentRepository,
    private readonly patientRepo: IPatientRepository,
    private readonly staffRepo: IStaffRepository,
    private readonly departmentRepo: IDepartmentRepository,
    private readonly scheduleRepo: IScheduleRepository,
  ) {}

  async bookAppointment(
    input: CreateAppointmentInput,
    creatorUserId: string,
  ): Promise<AppointmentResponseDto> {
    // 0. Look up creator and validate role / department restrictions
    const creator = await this.staffRepo.findById(creatorUserId);
    if (!creator) {
      throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
    }

    let effectiveDeptId: string | undefined = input.departmentId;

    if (creator.role === ROLES.RECEPTIONIST) {
      const creatorDeptId = creator.department
        ? typeof creator.department === 'object' && '_id' in (creator.department as object)
          ? (creator.department as { _id: { toString(): string } })._id.toString()
          : creator.department.toString()
        : null;

      if (!creatorDeptId) {
        throw new BadRequestError('Receptionist does not have an assigned department');
      }

      // If receptionist explicitly supplied a departmentId, verify it matches their assigned department
      if (input.departmentId && input.departmentId !== creatorDeptId) {
        throw new ForbiddenError(MESSAGES.RECEPTIONIST_DEPT_RESTRICTED);
      }

      effectiveDeptId = creatorDeptId;
    } else if (creator.role === ROLES.SUPER_ADMIN) {
      if (!effectiveDeptId) {
        throw new BadRequestError('Department ID is required for Super Admin appointment creation');
      }
    }

    // 1. Validate Patient (Universal patient record - any patient can visit any department)
    const patient = await this.patientRepo.findById(input.patientId);
    if (!patient || !patient.isActive) {
      throw new NotFoundError(MESSAGES.PATIENT_NOT_FOUND);
    }

    // 2. Validate Doctor
    const doctor = await this.staffRepo.findById(input.doctorId);
    if (!doctor || doctor.role !== ROLES.DOCTOR || !doctor.isActive) {
      throw new NotFoundError(MESSAGES.SCHEDULE_DOCTOR_NOT_FOUND);
    }

    // 3. Validate Department
    const department = await this.departmentRepo.findById(effectiveDeptId!);
    if (!department || !department.isActive) {
      throw new NotFoundError(MESSAGES.DEPARTMENT_NOT_FOUND);
    }

    // 4. Validate Doctor Department assignment
    const doctorDeptId =
      doctor.department && typeof doctor.department === 'object' && '_id' in (doctor.department as object)
        ? (doctor.department as { _id: { toString(): string } })._id.toString()
        : doctor.department?.toString();

    if (doctorDeptId !== effectiveDeptId) {
      throw new BadRequestError(MESSAGES.APPOINTMENT_DOCTOR_MISMATCH_DEPT);
    }

    // 5. Timezone & Past Date/Time validation
    const tz = env.HOSPITAL_TIMEZONE || 'UTC';
    const { isPastDate, isToday, currentTimeMinutes } = this.getTimeComparison(input.date, tz);
    const startMinutes = timeToMinutes(input.startTime);
    const endMinutes = timeToMinutes(input.endTime);

    if (isPastDate || (isToday && startMinutes < currentTimeMinutes)) {
      throw new BadRequestError(MESSAGES.APPOINTMENT_PAST_DATE);
    }

    // 6. Validate Doctor Schedule
    const schedule = await this.scheduleRepo.findByDoctorId(input.doctorId);
    if (!schedule || !schedule.isActive) {
      throw new BadRequestError(MESSAGES.APPOINTMENT_NO_SCHEDULE);
    }

    // Slot duration must match configured duration
    const slotDuration = endMinutes - startMinutes;
    if (slotDuration !== schedule.slotDuration) {
      throw new BadRequestError(MESSAGES.APPOINTMENT_INVALID_DURATION);
    }

    // Day of week check
    const { dayOfWeek } = this.getDayInfoForDate(input.date, tz);
    const dayConfig = schedule.workingDays.find((d) => d.dayOfWeek === dayOfWeek);
    if (!dayConfig || !dayConfig.isEnabled) {
      throw new BadRequestError(MESSAGES.APPOINTMENT_DAY_OFF);
    }

    // Session containment check
    const fitsInSession = dayConfig.sessions.some(
      (session) =>
        startMinutes >= timeToMinutes(session.startTime) &&
        endMinutes <= timeToMinutes(session.endTime),
    );
    if (!fitsInSession) {
      throw new BadRequestError(MESSAGES.APPOINTMENT_OUTSIDE_SESSION);
    }

    // Break non-overlap check
    const overlapsBreak = dayConfig.breaks.some((brk) => {
      const breakStart = timeToMinutes(brk.startTime);
      const breakEnd = timeToMinutes(brk.endTime);
      return startMinutes < breakEnd && endMinutes > breakStart;
    });
    if (overlapsBreak) {
      throw new BadRequestError(MESSAGES.APPOINTMENT_BREAK_CONFLICT);
    }

    // 7. Check for existing active overlapping appointments (read check)
    const existingAppointments = await this.appointmentRepo.findByDoctorAndDate(
      input.doctorId,
      input.date,
    );
    const hasOverlap = existingAppointments.some((app) => {
      const appStart = timeToMinutes(app.startTime);
      const appEnd = timeToMinutes(app.endTime);
      return startMinutes < appEnd && endMinutes > appStart;
    });
    if (hasOverlap) {
      throw new ConflictError(MESSAGES.APPOINTMENT_SLOT_ALREADY_BOOKED);
    }

    // 8. Atomic Creation with duplicate key concurrency protection
    try {
      const appointment = await this.appointmentRepo.create({
        patient: new Types.ObjectId(input.patientId),
        patientName: patient.fullName,
        doctor: new Types.ObjectId(input.doctorId),
        department: new Types.ObjectId(effectiveDeptId),
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        status: 'CONFIRMED',
        purpose: input.purpose,
        notes: input.notes || '',
        createdBy: new Types.ObjectId(creatorUserId),
      });

      return AppointmentMapper.toResponseDto(appointment);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: unknown }).code === 11000
      ) {
        throw new ConflictError(MESSAGES.APPOINTMENT_SLOT_ALREADY_BOOKED);
      }
      throw err;
    }
  }

  async markAsArrived(
    id: string,
    staffUserId: string,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.appointmentRepo.findById(id);
    if (!appointment) {
      throw new NotFoundError(MESSAGES.APPOINTMENT_NOT_FOUND);
    }

    // Check staff role & department scoping if receptionist
    const staff = await this.staffRepo.findById(staffUserId);
    if (!staff) {
      throw new UnauthorizedError(MESSAGES.UNAUTHORIZED);
    }

    if (staff.role === ROLES.RECEPTIONIST) {
      const staffDeptId = staff.department
        ? typeof staff.department === 'object' && '_id' in (staff.department as object)
          ? (staff.department as { _id: { toString(): string } })._id.toString()
          : staff.department.toString()
        : null;

      const appDeptId = appointment.department
        ? typeof appointment.department === 'object' && '_id' in (appointment.department as object)
          ? (appointment.department as { _id: { toString(): string } })._id.toString()
          : appointment.department.toString()
        : null;

      if (staffDeptId && appDeptId && staffDeptId !== appDeptId) {
        throw new ForbiddenError(MESSAGES.RECEPTIONIST_DEPT_RESTRICTED);
      }
    }

    if (appointment.status === 'ARRIVED') {
      throw new BadRequestError('Appointment is already marked as arrived');
    }

    if (appointment.status === 'COMPLETED' || appointment.status === 'CANCELLED') {
      throw new BadRequestError(MESSAGES.APPOINTMENT_CANNOT_REOPEN);
    }

    if (appointment.status !== 'SCHEDULED' && appointment.status !== 'CONFIRMED') {
      throw new BadRequestError(MESSAGES.APPOINTMENT_CANNOT_TRANSITION);
    }

    const updated = await this.appointmentRepo.update(id, {
      status: 'ARRIVED',
      arrivedAt: new Date(),
      arrivedBy: new Types.ObjectId(staffUserId),
    });

    return AppointmentMapper.toResponseDto(updated!);
  }

  async completeAppointment(
    id: string,
    requestingUser: RequestingUserContext,
    consultationNotes?: string,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.appointmentRepo.findById(id);
    if (!appointment) {
      throw new NotFoundError(MESSAGES.APPOINTMENT_NOT_FOUND);
    }

    // Doctor privacy isolation: Doctor can only complete their own appointments
    if (requestingUser.role === ROLES.DOCTOR) {
      const docDoctorId =
        appointment.doctor && typeof appointment.doctor === 'object' && '_id' in (appointment.doctor as object)
          ? (appointment.doctor as { _id: { toString(): string } })._id.toString()
          : appointment.doctor?.toString();

      if (docDoctorId !== requestingUser.userId) {
        throw new ForbiddenError(MESSAGES.FORBIDDEN);
      }
    } else if (requestingUser.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError(MESSAGES.FORBIDDEN);
    }

    if (appointment.status === 'COMPLETED') {
      throw new BadRequestError(MESSAGES.APPOINTMENT_ALREADY_COMPLETED);
    }

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestError(MESSAGES.APPOINTMENT_CANNOT_REOPEN);
    }

    const updatePayload: Record<string, unknown> = {
      status: 'COMPLETED',
      completedAt: new Date(),
      completedBy: new Types.ObjectId(requestingUser.userId),
    };

    if (consultationNotes !== undefined) {
      updatePayload['consultationNotes'] = consultationNotes.trim();
    }

    const updated = await this.appointmentRepo.update(id, updatePayload);
    return AppointmentMapper.toResponseDto(updated!);
  }

  async updateAppointment(
    id: string,
    requestingUser: RequestingUserContext,
    input: UpdateAppointmentInput,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.appointmentRepo.findById(id);
    if (!appointment) {
      throw new NotFoundError(MESSAGES.APPOINTMENT_NOT_FOUND);
    }

    // Role check: RECEPTIONIST or SUPER_ADMIN
    if (requestingUser.role === ROLES.RECEPTIONIST) {
      const staff = await this.staffRepo.findById(requestingUser.userId);
      const staffDeptId = staff?.department
        ? typeof staff.department === 'object' && '_id' in (staff.department as object)
          ? (staff.department as { _id: { toString(): string } })._id.toString()
          : staff.department.toString()
        : null;

      const appDeptId = appointment.department
        ? typeof appointment.department === 'object' && '_id' in (appointment.department as object)
          ? (appointment.department as { _id: { toString(): string } })._id.toString()
          : appointment.department.toString()
        : null;

      if (staffDeptId && appDeptId && staffDeptId !== appDeptId) {
        throw new ForbiddenError(MESSAGES.RECEPTIONIST_DEPT_RESTRICTED);
      }
    } else if (requestingUser.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError(MESSAGES.FORBIDDEN);
    }

    if (appointment.status === 'COMPLETED' || appointment.status === 'CANCELLED') {
      throw new BadRequestError(MESSAGES.APPOINTMENT_CANNOT_REOPEN);
    }

    const updatePayload: Record<string, unknown> = {};
    if (input.purpose !== undefined) {
      updatePayload['purpose'] = input.purpose.trim();
    }
    if (input.notes !== undefined) {
      updatePayload['notes'] = input.notes.trim();
    }

    const updated = await this.appointmentRepo.update(id, updatePayload);
    return AppointmentMapper.toResponseDto(updated!);
  }

  async updateConsultationNotes(
    id: string,
    requestingUser: RequestingUserContext,
    notes: string,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.appointmentRepo.findById(id);
    if (!appointment) {
      throw new NotFoundError(MESSAGES.APPOINTMENT_NOT_FOUND);
    }

    if (requestingUser.role === ROLES.DOCTOR) {
      const docDoctorId =
        appointment.doctor && typeof appointment.doctor === 'object' && '_id' in (appointment.doctor as object)
          ? (appointment.doctor as { _id: { toString(): string } })._id.toString()
          : appointment.doctor?.toString();

      if (docDoctorId !== requestingUser.userId) {
        throw new ForbiddenError(MESSAGES.APPOINTMENT_DOCTOR_ONLY_CONSULTATION);
      }
    } else if (requestingUser.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError(MESSAGES.APPOINTMENT_DOCTOR_ONLY_CONSULTATION);
    }

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestError(MESSAGES.APPOINTMENT_CANNOT_REOPEN);
    }

    const updated = await this.appointmentRepo.update(id, {
      consultationNotes: notes.trim(),
    });

    return AppointmentMapper.toResponseDto(updated!);
  }

  async rescheduleAppointment(
    id: string,
    requestingUser: RequestingUserContext,
    input: RescheduleAppointmentInput,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.appointmentRepo.findById(id);
    if (!appointment) {
      throw new NotFoundError(MESSAGES.APPOINTMENT_NOT_FOUND);
    }

    if (appointment.status === 'COMPLETED' || appointment.status === 'CANCELLED') {
      throw new BadRequestError(MESSAGES.APPOINTMENT_CANNOT_REOPEN);
    }

    // Check receptionist department restriction
    if (requestingUser.role === ROLES.RECEPTIONIST) {
      const staff = await this.staffRepo.findById(requestingUser.userId);
      const staffDeptId = staff?.department
        ? typeof staff.department === 'object' && '_id' in (staff.department as object)
          ? (staff.department as { _id: { toString(): string } })._id.toString()
          : staff.department.toString()
        : null;

      const appDeptId = appointment.department
        ? typeof appointment.department === 'object' && '_id' in (appointment.department as object)
          ? (appointment.department as { _id: { toString(): string } })._id.toString()
          : appointment.department.toString()
        : null;

      if (staffDeptId && appDeptId && staffDeptId !== appDeptId) {
        throw new ForbiddenError(MESSAGES.RECEPTIONIST_DEPT_RESTRICTED);
      }
    } else if (requestingUser.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError(MESSAGES.FORBIDDEN);
    }

    const doctorId =
      appointment.doctor && typeof appointment.doctor === 'object' && '_id' in (appointment.doctor as object)
        ? (appointment.doctor as { _id: { toString(): string } })._id.toString()
        : appointment.doctor?.toString();

    if (!doctorId) {
      throw new BadRequestError('Doctor not associated with this appointment');
    }

    // Timezone & Past Date/Time validation for new date/time
    const tz = env.HOSPITAL_TIMEZONE || 'UTC';
    const { isPastDate, isToday, currentTimeMinutes } = this.getTimeComparison(input.date, tz);
    const startMinutes = timeToMinutes(input.startTime);
    const endMinutes = timeToMinutes(input.endTime);

    if (isPastDate || (isToday && startMinutes < currentTimeMinutes)) {
      throw new BadRequestError(MESSAGES.APPOINTMENT_PAST_DATE);
    }

    // Validate Doctor Schedule
    const schedule = await this.scheduleRepo.findByDoctorId(doctorId);
    if (!schedule || !schedule.isActive) {
      throw new BadRequestError(MESSAGES.APPOINTMENT_NO_SCHEDULE);
    }

    const slotDuration = endMinutes - startMinutes;
    if (slotDuration !== schedule.slotDuration) {
      throw new BadRequestError(MESSAGES.APPOINTMENT_INVALID_DURATION);
    }

    const { dayOfWeek } = this.getDayInfoForDate(input.date, tz);
    const dayConfig = schedule.workingDays.find((d) => d.dayOfWeek === dayOfWeek);
    if (!dayConfig || !dayConfig.isEnabled) {
      throw new BadRequestError(MESSAGES.APPOINTMENT_DAY_OFF);
    }

    const fitsInSession = dayConfig.sessions.some(
      (session) =>
        startMinutes >= timeToMinutes(session.startTime) &&
        endMinutes <= timeToMinutes(session.endTime),
    );
    if (!fitsInSession) {
      throw new BadRequestError(MESSAGES.APPOINTMENT_OUTSIDE_SESSION);
    }

    const overlapsBreak = dayConfig.breaks.some((brk) => {
      const breakStart = timeToMinutes(brk.startTime);
      const breakEnd = timeToMinutes(brk.endTime);
      return startMinutes < breakEnd && endMinutes > breakStart;
    });
    if (overlapsBreak) {
      throw new BadRequestError(MESSAGES.APPOINTMENT_BREAK_CONFLICT);
    }

    // Overlapping appointment check on new date/time, excluding this appointment
    const existingAppointments = await this.appointmentRepo.findByDoctorAndDate(
      doctorId,
      input.date,
    );
    const hasOverlap = existingAppointments.some((app) => {
      if (app._id.toString() === id) return false;
      const appStart = timeToMinutes(app.startTime);
      const appEnd = timeToMinutes(app.endTime);
      return startMinutes < appEnd && endMinutes > appStart;
    });
    if (hasOverlap) {
      throw new ConflictError(MESSAGES.APPOINTMENT_SLOT_ALREADY_BOOKED);
    }

    const historyEntry = {
      previousDate: appointment.date,
      previousStartTime: appointment.startTime,
      previousEndTime: appointment.endTime,
      rescheduledAt: new Date(),
      rescheduledBy: new Types.ObjectId(requestingUser.userId),
      reason: input.reason?.trim() || '',
    };

    const newHistory = [...(appointment.rescheduleHistory || []), historyEntry];

    try {
      const updated = await this.appointmentRepo.update(id, {
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        status: 'CONFIRMED',
        rescheduleHistory: newHistory,
      });

      return AppointmentMapper.toResponseDto(updated!);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: unknown }).code === 11000
      ) {
        throw new ConflictError(MESSAGES.APPOINTMENT_SLOT_ALREADY_BOOKED);
      }
      throw err;
    }
  }

  async cancelAppointment(
    id: string,
    staffUserId: string,
    reason?: string,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.appointmentRepo.findById(id);
    if (!appointment) {
      throw new NotFoundError(MESSAGES.APPOINTMENT_NOT_FOUND);
    }

    const staff = await this.staffRepo.findById(staffUserId);
    if (staff && staff.role === ROLES.RECEPTIONIST) {
      const staffDeptId = staff.department
        ? typeof staff.department === 'object' && '_id' in (staff.department as object)
          ? (staff.department as { _id: { toString(): string } })._id.toString()
          : staff.department.toString()
        : null;

      const appDeptId = appointment.department
        ? typeof appointment.department === 'object' && '_id' in (appointment.department as object)
          ? (appointment.department as { _id: { toString(): string } })._id.toString()
          : appointment.department.toString()
        : null;

      if (staffDeptId && appDeptId && staffDeptId !== appDeptId) {
        throw new ForbiddenError(MESSAGES.RECEPTIONIST_DEPT_RESTRICTED);
      }
    }

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestError(MESSAGES.APPOINTMENT_ALREADY_CANCELLED);
    }

    if (appointment.status === 'COMPLETED') {
      throw new BadRequestError(MESSAGES.APPOINTMENT_ALREADY_COMPLETED);
    }

    const updated = await this.appointmentRepo.update(id, {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: new Types.ObjectId(staffUserId),
      cancellationReason: reason?.trim() || 'Cancelled by staff',
    });

    return AppointmentMapper.toResponseDto(updated!);
  }

  async getAppointmentById(
    id: string,
    requestingUser: RequestingUserContext,
  ): Promise<AppointmentResponseDto> {
    const appointment = await this.appointmentRepo.findById(id);
    if (!appointment) {
      throw new NotFoundError(MESSAGES.APPOINTMENT_NOT_FOUND);
    }

    if (requestingUser.role === ROLES.DOCTOR) {
      const doctorIdStr =
        appointment.doctor && typeof appointment.doctor === 'object' && '_id' in (appointment.doctor as object)
          ? (appointment.doctor as { _id: { toString(): string } })._id.toString()
          : appointment.doctor?.toString();

      if (doctorIdStr !== requestingUser.userId) {
        throw new ForbiddenError(MESSAGES.FORBIDDEN);
      }
    } else if (requestingUser.role === ROLES.RECEPTIONIST) {
      const staff = await this.staffRepo.findById(requestingUser.userId);
      const staffDeptId = staff?.department
        ? typeof staff.department === 'object' && '_id' in (staff.department as object)
          ? (staff.department as { _id: { toString(): string } })._id.toString()
          : staff.department.toString()
        : null;

      const appDeptId = appointment.department
        ? typeof appointment.department === 'object' && '_id' in (appointment.department as object)
          ? (appointment.department as { _id: { toString(): string } })._id.toString()
          : appointment.department.toString()
        : null;

      if (staffDeptId && appDeptId && staffDeptId !== appDeptId) {
        throw new ForbiddenError(MESSAGES.RECEPTIONIST_DEPT_RESTRICTED);
      }
    }

    return AppointmentMapper.toResponseDto(appointment);
  }

  async getAppointments(
    query: AppointmentQuery,
    requestingUser: RequestingUserContext,
  ): Promise<PaginatedAppointmentResponseDto> {
    const filter: AppointmentFilter = {};

    // Role-based restrictions:
    if (requestingUser.role === ROLES.DOCTOR) {
      // DOCTOR only sees their own appointments; reject any attempt to query another doctor
      if (query.doctorId && query.doctorId !== requestingUser.userId) {
        throw new ForbiddenError(MESSAGES.FORBIDDEN);
      }
      filter.doctor = requestingUser.userId;
    } else if (requestingUser.role === ROLES.RECEPTIONIST) {
      // RECEPTIONIST only sees appointments belonging to their assigned department
      const staff = await this.staffRepo.findById(requestingUser.userId);
      const staffDeptId = staff?.department
        ? typeof staff.department === 'object' && '_id' in (staff.department as object)
          ? (staff.department as { _id: { toString(): string } })._id.toString()
          : staff.department.toString()
        : null;

      if (query.departmentId && staffDeptId && query.departmentId !== staffDeptId) {
        throw new ForbiddenError(MESSAGES.RECEPTIONIST_DEPT_RESTRICTED);
      }

      if (staffDeptId) {
        filter.department = staffDeptId;
      }
      if (query.doctorId) {
        filter.doctor = query.doctorId;
      }
    } else {
      // SUPER_ADMIN can query any doctor or department optionally
      if (query.doctorId) {
        filter.doctor = query.doctorId;
      }
      if (query.departmentId) {
        filter.department = query.departmentId;
      }
    }

    if (query.status) {
      filter.status = query.status;
    }

    // Free-text patient search (Name, Patient ID, Mobile)
    if (query.search && query.search.trim().length > 0) {
      const patientIds = await this.patientRepo.findIdsBySearchTerm(query.search);
      if (patientIds.length === 0) {
        // Fast-path: 0 patients match the search term -> 0 appointments can match
        return {
          appointments: [],
          total: 0,
          totalPages: 1,
        };
      }
      filter.patient = { $in: patientIds };
    } else if (query.patientId) {
      filter.patient = query.patientId;
    }

    // Date / Date range handling
    if (query.date) {
      filter.date = query.date;
    } else {
      const start = query.startDate || query.fromDate;
      const end = query.endDate || query.toDate;
      if (start || end) {
        const dateFilter: { $gte?: string; $lte?: string } = {};
        if (start) dateFilter.$gte = start;
        if (end) dateFilter.$lte = end;
        filter.date = dateFilter;
      }
    }

    const sortMap: Record<string, 1 | -1> = {};
    const sortField = query.sortBy || 'date';
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;
    sortMap[sortField] = sortOrder;
    if (sortField === 'date') {
      sortMap['startTime'] = sortOrder;
    }

    const result = await this.appointmentRepo.findPaginated(
      filter,
      query.page,
      query.limit,
      sortMap,
    );

    return {
      appointments: result.appointments.map((doc) => AppointmentMapper.toResponseDto(doc)),
      total: result.total,
      totalPages: result.totalPages,
    };
  }

  private getDayInfoForDate(
    dateStr: string,
    tz: string,
  ): { dayOfWeek: number; dayName: string } {
    const [year, month, day] = dateStr.split('-').map(Number);
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
