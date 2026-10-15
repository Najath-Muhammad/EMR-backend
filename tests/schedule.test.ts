import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Application } from 'express';
import { ROLES } from '../src/constants/roles';
import { UserModel } from '../src/models/User.model';
import { DepartmentModel } from '../src/models/Department.model';
import { ScheduleModel } from '../src/models/Schedule.model';
import { AppointmentModel } from '../src/models/Appointment.model';
import { hashPassword } from '../src/utils/password.util';
import { generateAccessToken } from '../src/utils/token.util';

process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-access-secret-key-min-32-characters-12345';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-key-min-32-characters-67890';
process.env['PORT'] = '5005';
process.env['MONGODB_URI'] = 'mongodb://localhost:27017/unused_for_schedule_test';
process.env['SUPER_ADMIN_EMAIL'] = 'admin@hospital.com';

let app: Application;
let mongoServer: MongoMemoryServer;
let adminToken: string;
let doctorToken: string;
let receptionistToken: string;
let testDoctorId: string;
let testDeptId: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  await UserModel.init();
  await DepartmentModel.init();
  await ScheduleModel.init();
  await AppointmentModel.init();

  const { createApp } = await import('../src/app');
  app = createApp();

  const admin = await UserModel.create({
    name: 'Super Admin',
    email: 'admin@hospital.com',
    password: await hashPassword('Admin@123'),
    role: ROLES.SUPER_ADMIN,
    isActive: true,
    isActivated: true,
  });
  adminToken = generateAccessToken({ userId: admin._id.toString(), role: ROLES.SUPER_ADMIN });

  const dept = await DepartmentModel.create({
    name: 'Cardiology',
    code: 'CARD',
    isActive: true,
  });
  testDeptId = dept._id.toString();

  const doctor = await UserModel.create({
    name: 'Dr. Gregory House',
    email: 'house@hospital.com',
    password: await hashPassword('Doctor@123'),
    role: ROLES.DOCTOR,
    department: dept._id,
    specialization: 'Diagnostic Medicine',
    isActive: true,
    isActivated: true,
  });
  testDoctorId = doctor._id.toString();
  doctorToken = generateAccessToken({ userId: testDoctorId, role: ROLES.DOCTOR });

  const receptionist = await UserModel.create({
    name: 'Sarah Receptionist',
    email: 'sarah@hospital.com',
    password: await hashPassword('Rec@123'),
    role: ROLES.RECEPTIONIST,
    department: dept._id,
    isActive: true,
    isActivated: true,
  });
  receptionistToken = generateAccessToken({
    userId: receptionist._id.toString(),
    role: ROLES.RECEPTIONIST,
  });
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}, 30000);

beforeEach(async () => {
  await ScheduleModel.deleteMany({});
  await AppointmentModel.deleteMany({});
});

describe('Schedule Management Integration Tests', () => {
  const validSchedulePayload = {
    slotDuration: 15,
    isActive: true,
    workingDays: [
      {
        dayOfWeek: 1, // Monday
        dayName: 'MONDAY',
        isEnabled: true,
        sessions: [
          { startTime: '09:00', endTime: '12:00', label: 'Morning Session' },
          { startTime: '13:00', endTime: '17:00', label: 'Afternoon Session' },
        ],
        breaks: [{ startTime: '10:30', endTime: '10:45', label: 'Morning Tea' }],
      },
      {
        dayOfWeek: 2, // Tuesday
        dayName: 'TUESDAY',
        isEnabled: true,
        sessions: [{ startTime: '09:00', endTime: '13:00' }],
        breaks: [],
      },
      {
        dayOfWeek: 3, // Wednesday
        dayName: 'WEDNESDAY',
        isEnabled: false,
        sessions: [],
        breaks: [],
      },
    ],
  };

  describe('PUT /api/v1/doctors/:id/schedule (Super Admin Only)', () => {
    it('allows Super Admin to configure official schedule for a doctor', async () => {
      const res = await request(app)
        .put(`/api/v1/doctors/${testDoctorId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validSchedulePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slotDuration).toBe(15);
      expect(res.body.data.workingDays).toHaveLength(3);
      expect(res.body.data.doctor.id).toBe(testDoctorId);
    });

    it('rejects DOCTOR from modifying their own schedule (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/v1/doctors/${testDoctorId}/schedule`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(validSchedulePayload);

      expect(res.status).toBe(403);
    });

    it('rejects RECEPTIONIST from modifying doctor schedule (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/v1/doctors/${testDoctorId}/schedule`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send(validSchedulePayload);

      expect(res.status).toBe(403);
    });

    it('rejects schedule with invalid session times (endTime <= startTime)', async () => {
      const invalidPayload = {
        ...validSchedulePayload,
        workingDays: [
          {
            dayOfWeek: 1,
            dayName: 'MONDAY',
            isEnabled: true,
            sessions: [{ startTime: '14:00', endTime: '11:00' }],
            breaks: [],
          },
        ],
      };

      const res = await request(app)
        .put(`/api/v1/doctors/${testDoctorId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidPayload);

      expect(res.status).toBe(422);
      expect(res.body.message).toContain('Session endTime must be strictly after startTime');
    });

    it('rejects schedule with overlapping working sessions on the same day', async () => {
      const overlappingPayload = {
        ...validSchedulePayload,
        workingDays: [
          {
            dayOfWeek: 1,
            dayName: 'MONDAY',
            isEnabled: true,
            sessions: [
              { startTime: '09:00', endTime: '13:00' },
              { startTime: '12:00', endTime: '16:00' }, // Overlaps with 09:00-13:00
            ],
            breaks: [],
          },
        ],
      };

      const res = await request(app)
        .put(`/api/v1/doctors/${testDoctorId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(overlappingPayload);

      expect(res.status).toBe(422);
      expect(res.body.message).toContain('Overlapping working sessions');
    });

    it('rejects schedule with break outside working sessions', async () => {
      const breakOutsidePayload = {
        ...validSchedulePayload,
        workingDays: [
          {
            dayOfWeek: 1,
            dayName: 'MONDAY',
            isEnabled: true,
            sessions: [{ startTime: '09:00', endTime: '12:00' }],
            breaks: [{ startTime: '12:30', endTime: '13:00' }], // Outside 09:00-12:00
          },
        ],
      };

      const res = await request(app)
        .put(`/api/v1/doctors/${testDoctorId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(breakOutsidePayload);

      expect(res.status).toBe(422);
      expect(res.body.message).toContain('must fall completely within a scheduled working session');
    });
  });

  describe('GET /api/v1/doctors/:id/schedule', () => {
    it('retrieves configured schedule for a doctor', async () => {
      await request(app)
        .put(`/api/v1/doctors/${testDoctorId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validSchedulePayload);

      const res = await request(app)
        .get(`/api/v1/doctors/${testDoctorId}/schedule`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.slotDuration).toBe(15);
      expect(res.body.data.workingDays[0].dayName).toBe('MONDAY');
    });

    it('returns 404 when schedule has not yet been configured', async () => {
      const res = await request(app)
        .get(`/api/v1/doctors/${testDoctorId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/doctors/:id/schedule/status', () => {
    it('allows Super Admin to deactivate and reactivate doctor schedule', async () => {
      await request(app)
        .put(`/api/v1/doctors/${testDoctorId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validSchedulePayload);

      const deactRes = await request(app)
        .patch(`/api/v1/doctors/${testDoctorId}/schedule/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(deactRes.status).toBe(200);
      expect(deactRes.body.data.isActive).toBe(false);

      const actRes = await request(app)
        .patch(`/api/v1/doctors/${testDoctorId}/schedule/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: true });

      expect(actRes.status).toBe(200);
      expect(actRes.body.data.isActive).toBe(true);
    });
  });

  describe('Conflict Detection with Existing Bookings (Rule 6)', () => {
    it('detects and rejects schedule changes that would conflict with future booked appointments', async () => {
      // 1. Initial schedule: Mon 09:00 - 13:00
      await request(app)
        .put(`/api/v1/doctors/${testDoctorId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validSchedulePayload);

      // Next Monday date
      const futureDate = '2026-10-19'; // A future Monday

      // 2. An appointment is booked on that Monday at 11:00 - 11:30
      await AppointmentModel.create({
        doctor: testDoctorId,
        department: testDeptId,
        patientName: 'John Patient',
        date: futureDate,
        startTime: '11:00',
        endTime: '11:30',
        status: 'CONFIRMED',
      });

      // 3. Super Admin attempts to change Monday schedule to end at 10:30 (cutting off the 11:00 appointment!)
      const conflictingPayload = {
        ...validSchedulePayload,
        workingDays: [
          {
            dayOfWeek: 1, // Monday
            dayName: 'MONDAY',
            isEnabled: true,
            sessions: [{ startTime: '09:00', endTime: '10:30' }], // Cutoff!
            breaks: [],
          },
        ],
      };

      const res = await request(app)
        .put(`/api/v1/doctors/${testDoctorId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(conflictingPayload);

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('conflicts with existing booked appointments');

      // 4. Super Admin can force override if explicitly intended (?force=true)
      const forceRes = await request(app)
        .put(`/api/v1/doctors/${testDoctorId}/schedule?force=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(conflictingPayload);

      expect(forceRes.status).toBe(200);
      expect(forceRes.body.data.workingDays[0].sessions[0].endTime).toBe('10:30');
    });
  });

  describe('GET /api/v1/doctors', () => {
    it('returns list of doctors enriched with schedule configuration state', async () => {
      await request(app)
        .put(`/api/v1/doctors/${testDoctorId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validSchedulePayload);

      const res = await request(app)
        .get('/api/v1/doctors')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].hasSchedule).toBe(true);
      expect(res.body.data[0].isScheduleActive).toBe(true);
      expect(res.body.data[0].slotDuration).toBe(15);
    });
  });
});
