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
import { IRealtimeService } from '../interfaces/IRealtimeService';
import { IAuditLogService } from '../interfaces/IAuditLogService';

export class AppointmentService implements IAppointmentService {
  constructor(
    private readonly _appointmentRepo: IAppointmentRepository,
    private readonly _patientRepo: IPatientRepository,
    private readonly _staffRepo: IStaffRepository,
    private readonly _departmentRepo: IDepartmentRepository,
    private readonly _scheduleRepo: IScheduleRepository,
    private readonly _realtimeService?: IRealtimeService,
    private readonly _auditLogService?: IAuditLogService,
  ) {}

  async bookAppointment(
    input: CreateAppointmentInput,
    creatorUserId: string,
  ): Promise<AppointmentResponseDto> {
    try {

    const creator = await this._staffRepo.findById(creatorUserId);
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

      if (input.departmentId && input.departmentId !== creatorDeptId) {
        throw new ForbiddenError(MESSAGES.RECEPTIONIST_DEPT_RESTRICTED);
      }

      effectiveDeptId = creatorDeptId;
    } else if (creator.role === ROLES.SUPER_ADMIN) {
      if (!effectiveDeptId) {
        throw new BadRequestError('Department ID is required for Super Admin appointment creation');
      }
    }

    const patient = await this._patientRepo.findById(input.patientId);
    if (!patient || !patient.isActive) {
      throw new NotFoundError(MESSAGES.PATIENT_NOT_FOUND);
    }

    const doctor = await this._staffRepo.findById(input.doctorId);
    if (!doctor || doctor.role !== ROLES.DOCTOR || !doctor.isActive) {
      throw new NotFoundError(MESSAGES.SCHEDULE_DOCTOR_NOT_FOUND);
    }

    const department = await this._departmentRepo.findById(effectiveDeptId!);
    if (!department || !department.isActive) {
      throw new NotFoundError(MESSAGES.DEPARTMENT_NOT_FOUND);
    }

    const doctorDeptId =
      doctor.department && typeof doctor.department === 'object' && '_id' in (doctor.department as object)
        ? (doctor.department as { _id: { toString(): string } })._id.toString()
        : doctor.department?.toString();

    if (doctorDeptId !== effectiveDeptId) {
      throw new BadRequestError(MESSAGES.APPOINTMENT_DOCTOR_MISMATCH_DEPT);
    }

    const tz = env.HOSPITAL_TIMEZONE || 'UTC';
    const { isPastDate, isToday, currentTimeMinutes } = this.getTimeComparison(input.date, tz);
    const startMinutes = timeToMinutes(input.startTime);
    const endMinutes = timeToMinutes(input.endTime);

    if (isPastDate || (isToday && startMinutes < currentTimeMinutes)) {
      throw new BadRequestError(MESSAGES.APPOINTMENT_PAST_DATE);
    }

    const schedule = await this._scheduleRepo.findByDoctorId(input.doctorId);
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

    const existingAppointments = await this._appointmentRepo.findByDoctorAndDate(
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

    try {
      const appointment = await this._appointmentRepo.create({
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

      const dto = AppointmentMapper.toResponseDto(appointment);
      this._realtimeService?.emitAppointmentCreated(dto);
      void this._auditLogService?.log({
        action: 'APPOINTMENT_CREATE',
        entityType: 'Appointment',
        entityId: dto.id,
        actor: {
          userId: creator._id.toString(),
          email: creator.email,
          name: creator.name,
          role: creator.role,
        },
        details: {
          patientId: dto.patient?.id || input.patientId,
          patientName: dto.patient?.fullName,
          doctorId: dto.doctor?.id || input.doctorId,
          doctorName: dto.doctor?.name,
          departmentId: dto.department?.id || effectiveDeptId,
          date: dto.date,
          startTime: dto.startTime,
          endTime: dto.endTime,
          status: dto.status,
        },
      });

      return dto;
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
      } catch (error) {
      throw error;
    }
  }

  async markAsArrived(
    id: string,
    staffUserId: string,
  ): Promise<AppointmentResponseDto> {
    try {
    const appointment = await this._appointmentRepo.findById(id);
    if (!appointment) {
      throw new NotFoundError(MESSAGES.APPOINTMENT_NOT_FOUND);
    }

    const staff = await this._staffRepo.findById(staffUserId);
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

    const updated = await this._appointmentRepo.update(id, {
      status: 'ARRIVED',
      arrivedAt: new Date(),
      arrivedBy: new Types.ObjectId(staffUserId),
    });

    const dto = AppointmentMapper.toResponseDto(updated!);
    this._realtimeService?.emitAppointmentUpdated(dto, 'STATUS_CHANGED');
    void this._auditLogService?.log({
      action: 'APPOINTMENT_ARRIVED',
      entityType: 'Appointment',
      entityId: dto.id,
      actor: {
        userId: staff._id.toString(),
        email: staff.email,
        name: staff.name,
        role: staff.role,
      },
      details: {
        previousStatus: appointment.status,
        newStatus: 'ARRIVED',
      },
    });

    return dto;
      } catch (error) {
      throw error;
    }
  }

  async completeAppointment(
    id: string,
    requestingUser: RequestingUserContext,
    consultationNotes?: string,
  ): Promise<AppointmentResponseDto> {
    try {
    const appointment = await this._appointmentRepo.findById(id);
    if (!appointment) {
      throw new NotFoundError(MESSAGES.APPOINTMENT_NOT_FOUND);
    }

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

    const updated = await this._appointmentRepo.update(id, updatePayload);
    const dto = AppointmentMapper.toResponseDto(updated!);
    this._realtimeService?.emitAppointmentUpdated(dto, 'STATUS_CHANGED');
    void this._auditLogService?.log({
      action: 'APPOINTMENT_COMPLETED',
      entityType: 'Appointment',
      entityId: dto.id,
      actor: {
        userId: requestingUser.userId,
        role: requestingUser.role,
      },
      details: {
        previousStatus: appointment.status,
        newStatus: 'COMPLETED',
        hasConsultationNotes: Boolean(consultationNotes),
      },
    });

    return dto;
      } catch (error) {
      throw error;
    }
  }

  async updateAppointment(
    id: string,
    requestingUser: RequestingUserContext,
    input: UpdateAppointmentInput,
  ): Promise<AppointmentResponseDto> {
    try {
    const appointment = await this._appointmentRepo.findById(id);
    if (!appointment) {
      throw new NotFoundError(MESSAGES.APPOINTMENT_NOT_FOUND);
    }

    if (requestingUser.role === ROLES.RECEPTIONIST) {
      const staff = await this._staffRepo.findById(requestingUser.userId);
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

    const updated = await this._appointmentRepo.update(id, updatePayload);
    const dto = AppointmentMapper.toResponseDto(updated!);
    this._realtimeService?.emitAppointmentUpdated(dto, 'UPDATED');
    void this._auditLogService?.log({
      action: 'APPOINTMENT_UPDATE',
      entityType: 'Appointment',
      entityId: dto.id,
      actor: {
        userId: requestingUser.userId,
        role: requestingUser.role,
      },
      details: {
        updatedFields: Object.keys(updatePayload),
      },
    });

    return dto;
      } catch (error) {
      throw error;
    }
  }

  async updateConsultationNotes(
    id: string,
    requestingUser: RequestingUserContext,
    notes: string,
  ): Promise<AppointmentResponseDto> {
    try {
    const appointment = await this._appointmentRepo.findById(id);
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

    const updated = await this._appointmentRepo.update(id, {
      consultationNotes: notes.trim(),
    });

    const dto = AppointmentMapper.toResponseDto(updated!);
    this._realtimeService?.emitAppointmentUpdated(dto, 'UPDATED');
    void this._auditLogService?.log({
      action: 'APPOINTMENT_CONSULTATION_UPDATE',
      entityType: 'Appointment',
      entityId: dto.id,
      actor: {
        userId: requestingUser.userId,
        role: requestingUser.role,
      },
      details: {
        notesUpdated: true,
      },
    });

    return dto;
      } catch (error) {
      throw error;
    }
  }

  async rescheduleAppointment(
    id: string,
    requestingUser: RequestingUserContext,
    input: RescheduleAppointmentInput,
  ): Promise<AppointmentResponseDto> {
    try {
    const appointment = await this._appointmentRepo.findById(id);
    if (!appointment) {
      throw new NotFoundError(MESSAGES.APPOINTMENT_NOT_FOUND);
    }

    if (appointment.status === 'COMPLETED' || appointment.status === 'CANCELLED') {
      throw new BadRequestError(MESSAGES.APPOINTMENT_CANNOT_REOPEN);
    }

    if (requestingUser.role === ROLES.RECEPTIONIST) {
      const staff = await this._staffRepo.findById(requestingUser.userId);
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

    const tz = env.HOSPITAL_TIMEZONE || 'UTC';
    const { isPastDate, isToday, currentTimeMinutes } = this.getTimeComparison(input.date, tz);
    const startMinutes = timeToMinutes(input.startTime);
    const endMinutes = timeToMinutes(input.endTime);

    if (isPastDate || (isToday && startMinutes < currentTimeMinutes)) {
      throw new BadRequestError(MESSAGES.APPOINTMENT_PAST_DATE);
    }

    const schedule = await this._scheduleRepo.findByDoctorId(doctorId);
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

    const existingAppointments = await this._appointmentRepo.findByDoctorAndDate(
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
      const updated = await this._appointmentRepo.update(id, {
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        status: 'CONFIRMED',
        rescheduleHistory: newHistory,
      });

      const dto = AppointmentMapper.toResponseDto(updated!);
      this._realtimeService?.emitAppointmentUpdated(dto, 'RESCHEDULED');
      void this._auditLogService?.log({
        action: 'APPOINTMENT_RESCHEDULED',
        entityType: 'Appointment',
        entityId: dto.id,
        actor: {
          userId: requestingUser.userId,
          role: requestingUser.role,
        },
        details: {
          previousDate: appointment.date,
          newDate: input.date,
          previousStartTime: appointment.startTime,
          newStartTime: input.startTime,
          previousEndTime: appointment.endTime,
          newEndTime: input.endTime,
          reason: input.reason?.trim() || '',
        },
      });

      return dto;
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
      } catch (error) {
      throw error;
    }
  }

  async cancelAppointment(
    id: string,
    staffUserId: string,
    reason?: string,
  ): Promise<AppointmentResponseDto> {
    try {
    const appointment = await this._appointmentRepo.findById(id);
    if (!appointment) {
      throw new NotFoundError(MESSAGES.APPOINTMENT_NOT_FOUND);
    }

    const staff = await this._staffRepo.findById(staffUserId);
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

    const updated = await this._appointmentRepo.update(id, {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: new Types.ObjectId(staffUserId),
      cancellationReason: reason?.trim() || 'Cancelled by staff',
    });

    const dto = AppointmentMapper.toResponseDto(updated!);
    this._realtimeService?.emitAppointmentCancelled(dto);
    void this._auditLogService?.log({
      action: 'APPOINTMENT_CANCEL',
      entityType: 'Appointment',
      entityId: dto.id,
      actor: {
        userId: staff ? staff._id.toString() : staffUserId,
        email: staff?.email,
        name: staff?.name,
        role: staff?.role,
      },
      details: {
        previousStatus: appointment.status,
        newStatus: 'CANCELLED',
        cancellationReason: reason?.trim() || 'Cancelled by staff',
      },
    });

    return dto;
      } catch (error) {
      throw error;
    }
  }

  async getAppointmentById(
    id: string,
    requestingUser: RequestingUserContext,
  ): Promise<AppointmentResponseDto> {
    try {
    const appointment = await this._appointmentRepo.findById(id);
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
      const staff = await this._staffRepo.findById(requestingUser.userId);
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
      } catch (error) {
      throw error;
    }
  }

  async getAppointments(
    query: AppointmentQuery,
    requestingUser: RequestingUserContext,
  ): Promise<PaginatedAppointmentResponseDto> {
    try {
    const filter: AppointmentFilter = {};

    if (requestingUser.role === ROLES.DOCTOR) {

      if (query.doctorId && query.doctorId !== requestingUser.userId) {
        throw new ForbiddenError(MESSAGES.FORBIDDEN);
      }
      filter.doctor = requestingUser.userId;
    } else if (requestingUser.role === ROLES.RECEPTIONIST) {

      const staff = await this._staffRepo.findById(requestingUser.userId);
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

    if (query.search && query.search.trim().length > 0) {
      const patientIds = await this._patientRepo.findIdsBySearchTerm(query.search);
      if (patientIds.length === 0) {

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

    const result = await this._appointmentRepo.findPaginated(
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
      } catch (error) {
      throw error;
    }
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
    const todayStr = dateFormatter.format(now);

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
