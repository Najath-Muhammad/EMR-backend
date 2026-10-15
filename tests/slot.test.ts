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
process.env['PORT'] = '5006';
process.env['MONGODB_URI'] = 'mongodb://localhost:27017/unused_for_slot_test';
process.env['HOSPITAL_TIMEZONE'] = 'UTC';

let app: Application;
let mongoServer: MongoMemoryServer;
let adminToken: string;
let doctorToken: string;
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

describe('Dynamic Slot Generation Integration Tests', () => {
  // A future date for deterministic slot generation tests
  // We use 2030-01-01 (Tuesday) to ensure it is always in the future
  const futureTuesday = '2030-01-01';

  it('generates exact 15-minute slots: 09:00, 09:15, 09:30, 09:45 for session 09:00-10:00', async () => {
    // 2030-01-01 is Tuesday (dayOfWeek: 2)
    await ScheduleModel.create({
      doctor: testDoctorId,
      slotDuration: 15,
      isActive: true,
      workingDays: [
        {
          dayOfWeek: 2, // Tuesday
          dayName: 'TUESDAY',
          isEnabled: true,
          sessions: [{ startTime: '09:00', endTime: '10:00' }],
          breaks: [],
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/slots?doctorId=${testDoctorId}&date=${futureTuesday}`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slots).toHaveLength(4);

    const slotTimes = res.body.data.slots.map((s: { startTime: string; endTime: string }) => `${s.startTime}-${s.endTime}`);
    expect(slotTimes).toEqual([
      '09:00-09:15',
      '09:15-09:30',
      '09:30-09:45',
      '09:45-10:00',
    ]);

    // All future slots must be available
    expect(res.body.data.availableSlots).toBe(4);
    expect(res.body.data.slots.every((s: { isAvailable: boolean }) => s.isAvailable)).toBe(true);
  });

  it('ensures each slot fits completely within its session boundary (Rule 5)', async () => {
    // Session 09:00 - 09:50 with 15m duration:
    // Slot 1: 09:00 - 09:15 (fits)
    // Slot 2: 09:15 - 09:30 (fits)
    // Slot 3: 09:30 - 09:45 (fits)
    // Slot 4: 09:45 - 10:00 would exceed 09:50, so it must NOT be generated!
    await ScheduleModel.create({
      doctor: testDoctorId,
      slotDuration: 15,
      isActive: true,
      workingDays: [
        {
          dayOfWeek: 2,
          dayName: 'TUESDAY',
          isEnabled: true,
          sessions: [{ startTime: '09:00', endTime: '09:50' }],
          breaks: [],
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/slots?doctorId=${testDoctorId}&date=${futureTuesday}`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.slots).toHaveLength(3);
    expect(res.body.data.slots[2].startTime).toBe('09:30');
    expect(res.body.data.slots[2].endTime).toBe('09:45');
  });

  it('never generates slots during scheduled breaks (Rule 2)', async () => {
    // Session: 09:00 - 12:00
    // Break: 10:30 - 11:00 (Lunch)
    // Slots between 10:30 and 11:00 must be omitted!
    await ScheduleModel.create({
      doctor: testDoctorId,
      slotDuration: 30,
      isActive: true,
      workingDays: [
        {
          dayOfWeek: 2,
          dayName: 'TUESDAY',
          isEnabled: true,
          sessions: [{ startTime: '09:00', endTime: '12:00' }],
          breaks: [{ startTime: '10:30', endTime: '11:00', label: 'Coffee Break' }],
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/slots?doctorId=${testDoctorId}&date=${futureTuesday}`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    const startTimes = res.body.data.slots.map((s: { startTime: string }) => s.startTime);
    // 09:00, 09:30, 10:00, (10:30 skipped due to break), 11:00, 11:30
    expect(startTimes).toEqual(['09:00', '09:30', '10:00', '11:00', '11:30']);
    expect(startTimes).not.toContain('10:30');
  });

  it('supports multiple working sessions per day and never generates slots outside sessions', async () => {
    // Session 1: 09:00 - 11:00
    // Session 2: 14:00 - 16:00
    await ScheduleModel.create({
      doctor: testDoctorId,
      slotDuration: 60,
      isActive: true,
      workingDays: [
        {
          dayOfWeek: 2,
          dayName: 'TUESDAY',
          isEnabled: true,
          sessions: [
            { startTime: '09:00', endTime: '11:00' },
            { startTime: '14:00', endTime: '16:00' },
          ],
          breaks: [],
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/slots?doctorId=${testDoctorId}&date=${futureTuesday}`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    const startTimes = res.body.data.slots.map((s: { startTime: string }) => s.startTime);
    expect(startTimes).toEqual(['09:00', '10:00', '14:00', '15:00']);
  });

  it('marks slots as unavailable (PAST_TIME) for past dates (Rule 3)', async () => {
    await ScheduleModel.create({
      doctor: testDoctorId,
      slotDuration: 30,
      isActive: true,
      workingDays: [
        {
          dayOfWeek: 2, // 2020-01-07 was a Tuesday
          dayName: 'TUESDAY',
          isEnabled: true,
          sessions: [{ startTime: '09:00', endTime: '11:00' }],
          breaks: [],
        },
      ],
    });

    const pastDate = '2020-01-07';
    const res = await request(app)
      .get(`/api/v1/slots?doctorId=${testDoctorId}&date=${pastDate}`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.slots.length).toBeGreaterThan(0);
    expect(res.body.data.availableSlots).toBe(0);
    expect(res.body.data.slots.every((s: { isAvailable: boolean; reason: string }) => !s.isAvailable && s.reason === 'PAST_TIME')).toBe(true);
  });

  it('marks slots as unavailable (BOOKED) when overlapping an existing appointment (Rule 7)', async () => {
    await ScheduleModel.create({
      doctor: testDoctorId,
      slotDuration: 30,
      isActive: true,
      workingDays: [
        {
          dayOfWeek: 2,
          dayName: 'TUESDAY',
          isEnabled: true,
          sessions: [{ startTime: '09:00', endTime: '11:00' }],
          breaks: [],
        },
      ],
    });

    // Book appointment on 2030-01-01 at 09:30-10:00
    await AppointmentModel.create({
      doctor: testDoctorId,
      department: testDeptId,
      patientName: 'Jane Patient',
      date: futureTuesday,
      startTime: '09:30',
      endTime: '10:00',
      status: 'CONFIRMED',
    });

    const res = await request(app)
      .get(`/api/v1/slots?doctorId=${testDoctorId}&date=${futureTuesday}`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalSlots).toBe(4); // 09:00, 09:30, 10:00, 10:30
    expect(res.body.data.availableSlots).toBe(3);

    const bookedSlot = res.body.data.slots.find((s: { startTime: string }) => s.startTime === '09:30');
    expect(bookedSlot.isAvailable).toBe(false);
    expect(bookedSlot.reason).toBe('BOOKED');

    const availableSlot = res.body.data.slots.find((s: { startTime: string }) => s.startTime === '09:00');
    expect(availableSlot.isAvailable).toBe(true);
  });

  it('returns 0 slots on days marked isEnabled: false', async () => {
    await ScheduleModel.create({
      doctor: testDoctorId,
      slotDuration: 15,
      isActive: true,
      workingDays: [
        {
          dayOfWeek: 2,
          dayName: 'TUESDAY',
          isEnabled: false, // Day Off!
          sessions: [{ startTime: '09:00', endTime: '12:00' }],
          breaks: [],
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/slots?doctorId=${testDoctorId}&date=${futureTuesday}`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalSlots).toBe(0);
    expect(res.body.data.slots).toHaveLength(0);
  });

  describe('POST /api/v1/slots/preview', () => {
    it('generates real-time slot preview without requiring database persistence', async () => {
      const previewPayload = {
        date: futureTuesday,
        schedule: {
          slotDuration: 20,
          isActive: true,
          workingDays: [
            {
              dayOfWeek: 2,
              dayName: 'TUESDAY',
              isEnabled: true,
              sessions: [{ startTime: '08:00', endTime: '09:00' }],
              breaks: [],
            },
          ],
        },
      };

      const res = await request(app)
        .post('/api/v1/slots/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(previewPayload);

      expect(res.status).toBe(200);
      expect(res.body.data.totalSlots).toBe(3); // 08:00-08:20, 08:20-08:40, 08:40-09:00
      expect(res.body.data.slots[0].startTime).toBe('08:00');
      expect(res.body.data.slots[0].endTime).toBe('08:20');
      expect(res.body.data.slots[2].startTime).toBe('08:40');
      expect(res.body.data.slots[2].endTime).toBe('09:00');
    });
  });
});
