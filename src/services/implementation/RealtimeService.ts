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
    try {
      this.io = io;
    } catch (error) {
      throw error;
    }
  }

  getIO(): SocketIOServer | null {
    try {
      return this.io;
    } catch (error) {
      throw error;
    }
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
    try {
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

      this.io.to('role:SUPER_ADMIN').emit(eventName, payload);

      if (departmentId) {
        this.io.to(`department:${departmentId}`).emit(eventName, payload);
      }

      if (doctorId) {
        this.io.to(`doctor:${doctorId}`).emit(eventName, payload);
      }

      logger.debug(`Broadcast ${eventName} [${action}]`, {
        appointmentId: appointment.id,
        departmentId,
        doctorId,
      });
    } catch (error) {
      logger.error('Failed to broadcast realtime event', {
        eventName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  emitAppointmentCreated(appointment: AppointmentResponseDto): void {
    try {
      this.broadcast('appointment:created', 'CREATED', appointment);
    } catch (error) {
      throw error;
    }
  }

  emitAppointmentUpdated(
    appointment: AppointmentResponseDto,
    action: RealtimeAppointmentAction = 'UPDATED',
  ): void {
    try {
      this.broadcast('appointment:updated', action, appointment);
    } catch (error) {
      throw error;
    }
  }

  emitAppointmentCancelled(appointment: AppointmentResponseDto): void {
    try {
      this.broadcast('appointment:cancelled', 'CANCELLED', appointment);
    } catch (error) {
      throw error;
    }
  }
}

export const realtimeService = new RealtimeService();
