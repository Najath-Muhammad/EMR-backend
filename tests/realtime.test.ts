import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';
import mongoose from 'mongoose';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../src/app';
import { initSocket } from '../src/socket';
import { realtimeService } from '../src/services/implementation/RealtimeService';
import { UserModel } from '../src/models/User.model';
import { DepartmentModel } from '../src/models/Department.model';
import { ROLES } from '../src/constants/roles';
import { generateAccessToken } from '../src/utils/token.util';
import { hashPassword } from '../src/utils/password.util';
import { AppointmentResponseDto } from '../src/dtos/appointment.dto';
import { AppointmentService } from '../src/services/implementation/AppointmentService';
import { IAppointmentRepository } from '../src/repositories/interfaces/IAppointmentRepository';
import { IPatientRepository } from '../src/repositories/interfaces/IPatientRepository';
import { IStaffRepository } from '../src/repositories/interfaces/IStaffRepository';
import { IDepartmentRepository } from '../src/repositories/interfaces/IDepartmentRepository';
import { IScheduleRepository } from '../src/repositories/interfaces/IScheduleRepository';
import { IRealtimeService } from '../src/services/interfaces/IRealtimeService';

let server: http.Server;
let port: number;
let serverUrl: string;

let adminToken: string;
let doctor1Token: string;
let doctor2Token: string;
let receptionistToken: string;

let doctor1Id: string;
let doctor2Id: string;
let dept1Id: string;
let dept2Id: string;

beforeAll(async () => {
  const uri = process.env['MONGODB_URI'] || 'mongodb://localhost:27017/emr_test';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }

  const app = createApp();
  server = http.createServer(app);
  initSocket(server);

  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        port = address.port;
        serverUrl = `http://localhost:${port}`;
      }
      resolve();
    });
  });

  const pwd = await hashPassword('Doctor@123');

  // Create Departments
  const dept1 = await DepartmentModel.create({
    name: 'Realtime Cardio',
    code: 'RTC',
    isActive: true,
  });
  dept1Id = dept1._id.toString();

  const dept2 = await DepartmentModel.create({
    name: 'Realtime Neuro',
    code: 'RTN',
    isActive: true,
  });
  dept2Id = dept2._id.toString();
  expect(dept2Id).toBeDefined();

  // Create Users
  const admin = await UserModel.create({
    name: 'Realtime Admin',
    email: 'admin.realtime@hospital.com',
    password: pwd,
    role: ROLES.SUPER_ADMIN,
    isActive: true,
  });
  adminToken = generateAccessToken({ userId: admin._id.toString(), role: ROLES.SUPER_ADMIN });

  const doc1 = await UserModel.create({
    name: 'Doctor One',
    email: 'doc1.realtime@hospital.com',
    password: pwd,
    role: ROLES.DOCTOR,
    department: dept1._id,
    isActive: true,
  });
  doctor1Id = doc1._id.toString();
  doctor1Token = generateAccessToken({ userId: doctor1Id, role: ROLES.DOCTOR });

  const doc2 = await UserModel.create({
    name: 'Doctor Two',
    email: 'doc2.realtime@hospital.com',
    password: pwd,
    role: ROLES.DOCTOR,
    department: dept2._id,
    isActive: true,
  });
  doctor2Id = doc2._id.toString();
  doctor2Token = generateAccessToken({ userId: doctor2Id, role: ROLES.DOCTOR });

  const recep = await UserModel.create({
    name: 'Receptionist One',
    email: 'recep.realtime@hospital.com',
    password: pwd,
    role: ROLES.RECEPTIONIST,
    department: dept1._id,
    isActive: true,
  });
  receptionistToken = generateAccessToken({ userId: recep._id.toString(), role: ROLES.RECEPTIONIST });
});

afterAll(async () => {
  await UserModel.deleteMany({ email: /realtime/ });
  await DepartmentModel.deleteMany({ code: /RT/ });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await mongoose.disconnect();
});

function createClient(token?: string): ClientSocket {
  return ioClient(serverUrl, {
    transports: ['websocket'],
    autoConnect: true,
    auth: token ? { token } : undefined,
  });
}

describe('Socket.IO Real-Time Updates & Role/Department Isolation', () => {
  describe('Handshake Authentication', () => {
    it('authenticates and connects client with valid JWT token', async () => {
      const client = createClient(adminToken);

      await new Promise<void>((resolve, reject) => {
        client.on('connect', () => {
          expect(client.connected).toBe(true);
          client.disconnect();
          resolve();
        });
        client.on('connect_error', (err) => {
          client.disconnect();
          reject(err);
        });
      });
    });

    it('rejects connection when token is missing', async () => {
      const client = createClient(undefined);

      await new Promise<void>((resolve) => {
        client.on('connect_error', (err) => {
          expect(err.message).toMatch(/Authentication error/);
          client.disconnect();
          resolve();
        });
      });
    });

    it('rejects connection when token is invalid', async () => {
      const client = createClient('invalid-garbage-token');

      await new Promise<void>((resolve) => {
        client.on('connect_error', (err) => {
          expect(err.message).toMatch(/Authentication error/);
          client.disconnect();
          resolve();
        });
      });
    });
  });

  describe('Doctor & Department Privacy Isolation', () => {
    it('delivers appointment events to the assigned doctor, assigned receptionist, and admin, but NOT other doctors', async () => {
      const adminClient = createClient(adminToken);
      const doc1Client = createClient(doctor1Token);
      const doc2Client = createClient(doctor2Token);
      const recepClient = createClient(receptionistToken);

      // Wait for all 4 clients to connect
      await Promise.all([
        new Promise<void>((r) => adminClient.on('connect', () => r())),
        new Promise<void>((r) => doc1Client.on('connect', () => r())),
        new Promise<void>((r) => doc2Client.on('connect', () => r())),
        new Promise<void>((r) => recepClient.on('connect', () => r())),
      ]);

      const mockAppointment: AppointmentResponseDto = {
        id: 'app-rt-001',
        appointmentId: 'APP-2026-00001',
        patient: { id: 'pat-1', patientId: 'PAT-001', fullName: 'John Doe', phone: '+1234567890' },
        doctor: { id: doctor1Id, name: 'Doctor One', specialization: 'Cardiology' },
        department: { id: dept1Id, name: 'Realtime Cardio', code: 'RTC' },
        date: '2026-10-20',
        startTime: '10:00',
        endTime: '10:30',
        status: 'CONFIRMED',
        purpose: 'Routine checkup',
        rescheduleHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      let adminReceived = false;
      let doc1Received = false;
      let recepReceived = false;
      let doc2Received = false;

      adminClient.on('appointment:created', () => { adminReceived = true; });
      doc1Client.on('appointment:created', () => { doc1Received = true; });
      recepClient.on('appointment:created', () => { recepReceived = true; });
      doc2Client.on('appointment:created', () => { doc2Received = true; });

      // Emit appointment event for Doctor 1 & Department 1
      realtimeService.emitAppointmentCreated(mockAppointment);

      // Wait 300ms for event propagation
      await new Promise((r) => setTimeout(r, 300));

      // Assertions
      expect(adminReceived).toBe(true);
      expect(doc1Received).toBe(true);
      expect(recepReceived).toBe(true);
      expect(doc2Received).toBe(false); // Doctor 2 in Department 2 MUST NOT receive it!

      adminClient.disconnect();
      doc1Client.disconnect();
      doc2Client.disconnect();
      recepClient.disconnect();
    });

    it('delivers appointment:updated and appointment:cancelled with matching payloads', async () => {
      const doc1Client = createClient(doctor1Token);
      await new Promise<void>((r) => doc1Client.on('connect', () => r()));

      const mockAppointment: AppointmentResponseDto = {
        id: 'app-rt-002',
        appointmentId: 'APP-2026-00002',
        doctor: { id: doctor1Id, name: 'Doctor One' },
        department: { id: dept1Id, name: 'Realtime Cardio' },
        date: '2026-10-20',
        startTime: '11:00',
        endTime: '11:30',
        status: 'ARRIVED',
        rescheduleHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      let updateReceived = false;
      let cancelReceived = false;

      doc1Client.on('appointment:updated', (payload) => {
        expect(payload.action).toBe('STATUS_CHANGED');
        expect(payload.appointment.id).toBe('app-rt-002');
        updateReceived = true;
      });

      doc1Client.on('appointment:cancelled', (payload) => {
        expect(payload.action).toBe('CANCELLED');
        expect(payload.appointment.id).toBe('app-rt-002');
        cancelReceived = true;
      });

      realtimeService.emitAppointmentUpdated(mockAppointment, 'STATUS_CHANGED');
      realtimeService.emitAppointmentCancelled(mockAppointment);

      await new Promise((r) => setTimeout(r, 200));

      expect(updateReceived).toBe(true);
      expect(cancelReceived).toBe(true);

      doc1Client.disconnect();
    });
  });

  describe('Persistence Failure Behavior', () => {
    it('does NOT emit real-time events when database persistence fails', async () => {
      const mockRealtime = {
        emitAppointmentCreated: vi.fn(),
        emitAppointmentUpdated: vi.fn(),
        emitAppointmentCancelled: vi.fn(),
      };

      const mockAppointmentRepo = {
        findById: vi.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          status: 'CONFIRMED',
          department: new mongoose.Types.ObjectId(),
          doctor: new mongoose.Types.ObjectId(),
        }),
        update: vi.fn().mockRejectedValue(new Error('MongoDB Connection Dropped')),
      };

      const mockStaffRepo = {
        findById: vi.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          role: ROLES.SUPER_ADMIN,
        }),
      };

      const service = new AppointmentService(
        mockAppointmentRepo as unknown as IAppointmentRepository,
        {} as unknown as IPatientRepository,
        mockStaffRepo as unknown as IStaffRepository,
        {} as unknown as IDepartmentRepository,
        {} as unknown as IScheduleRepository,
        mockRealtime as unknown as IRealtimeService,
      );

      const validAppId = new mongoose.Types.ObjectId().toString();
      const validStaffId = new mongoose.Types.ObjectId().toString();

      // Attempt to mark as arrived — repo fails
      await expect(
        service.markAsArrived(validAppId, validStaffId),
      ).rejects.toThrow('MongoDB Connection Dropped');

      // Verify that NO real-time event was emitted
      expect(mockRealtime.emitAppointmentUpdated).not.toHaveBeenCalled();
    });
  });
});
