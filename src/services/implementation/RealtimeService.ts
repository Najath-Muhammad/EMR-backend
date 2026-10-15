import { Server as SocketIOServer } from 'socket.io';
import {
  IRealtimeService,
  RealtimeAppointmentAction,
  AppointmentRealtimePayload,
} from '../interfaces/IRealtimeService';
import { AppointmentResponseDto } from '../../dtos/appointment.dto';
import { logger } from '../../utils/logger';

export class RealtimeService implements IRealtimeService {
  private io: SocketIOServer | null = null;

  setIO(io: SocketIOServer): void {
    this.io = io;
  }

  getIO(): SocketIOServer | null {
    return this.io;
  }

  private resolveIds(appointment: AppointmentResponseDto): {
    departmentId: string;
    doctorId: string;
  } {
    const departmentId =
      typeof appointment.department === 'object' && appointment.department
        ? appointment.department.id
        : String(appointment.department || '');

    const doctorId =
      typeof appointment.doctor === 'object' && appointment.doctor
        ? appointment.doctor.id
        : String(appointment.doctor || '');

    return { departmentId, doctorId };
  }

  private broadcast(
    eventName: string,
    action: RealtimeAppointmentAction,
    appointment: AppointmentResponseDto,
  ): void {
    if (!this.io) {
      logger.debug(`RealtimeService: Socket.IO not initialized, skipping broadcast of ${eventName}`);
      return;
    }

    const { departmentId, doctorId } = this.resolveIds(appointment);
    const payload: AppointmentRealtimePayload = {
      action,
      appointment,
      departmentId,
      doctorId,
      timestamp: new Date().toISOString(),
    };

    // 1. Super Admin room gets all events
    this.io.to('role:SUPER_ADMIN').emit(eventName, payload);

    // 2. Department room for receptionists assigned to this department
    if (departmentId) {
      this.io.to(`department:${departmentId}`).emit(eventName, payload);
    }

    // 3. Doctor room exclusively for the assigned doctor
    if (doctorId) {
      this.io.to(`doctor:${doctorId}`).emit(eventName, payload);
    }

    logger.debug(`Broadcast ${eventName} [${action}]`, {
      appointmentId: appointment.id,
      departmentId,
      doctorId,
    });
  }

  emitAppointmentCreated(appointment: AppointmentResponseDto): void {
    this.broadcast('appointment:created', 'CREATED', appointment);
  }

  emitAppointmentUpdated(
    appointment: AppointmentResponseDto,
    action: RealtimeAppointmentAction = 'UPDATED',
  ): void {
    this.broadcast('appointment:updated', action, appointment);
  }

  emitAppointmentCancelled(appointment: AppointmentResponseDto): void {
    this.broadcast('appointment:cancelled', 'CANCELLED', appointment);
  }
}

// Global instance for injection across composition roots
export const realtimeService = new RealtimeService();
