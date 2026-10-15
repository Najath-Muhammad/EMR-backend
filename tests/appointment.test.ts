import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Application } from 'express';
import { ROLES } from '../src/constants/roles';
import { UserModel } from '../src/models/User.model';
import { DepartmentModel } from '../src/models/Department.model';
import { PatientModel } from '../src/models/Patient.model';
import { ScheduleModel } from '../src/models/Schedule.model';
import { AppointmentModel } from '../src/models/Appointment.model';
import { hashPassword } from '../src/utils/password.util';
import { generateAccessToken } from '../src/utils/token.util';
import { MESSAGES } from '../src/constants/messages';

process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-access-secret-key-min-32-characters-12345';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-key-min-32-characters-67890';
process.env['PORT'] = '5007';
process.env['MONGODB_URI'] = 'mongodb://localhost:27017/unused_for_appointment_test';
process.env['HOSPITAL_TIMEZONE'] = 'UTC';

let app: Application;
let mongoServer: MongoMemoryServer;

let adminToken: string;
let receptionistToken: string;
let doctorToken: string;
let otherDoctorToken: string;

let cardioDeptId: string;
let neuroDeptId: string;
let doctorId: string;
let otherDoctorId: string;
let patientId: string;
let receptionistUserId: string;

// Future Tuesday for tests (2030-01-01 is a Tuesday)
const FUTURE_TUESDAY = '2030-01-01';

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Initialize all model indexes (including partial unique index on Appointment)
  await UserModel.init();
  await DepartmentModel.init();
  await PatientModel.init();
  await ScheduleModel.init();
  await AppointmentModel.init();

  const { createApp } = await import('../src/app');
  app = createApp();

  // Create Admin
  const admin = await UserModel.create({
    name: 'Super Admin',
    email: 'admin@hospital.com',
    password: await hashPassword('Admin@123'),
    role: ROLES.SUPER_ADMIN,
    isActive: true,
    isActivated: true,
  });
  adminToken = generateAccessToken({ userId: admin._id.toString(), role: ROLES.SUPER_ADMIN });

  // Create Departments
  const cardio = await DepartmentModel.create({
    name: 'Cardiology',
    code: 'CARDIO',
    isActive: true,
  });
  cardioDeptId = cardio._id.toString();

  const neuro = await DepartmentModel.create({
    name: 'Neurology',
    code: 'NEURO',
    isActive: true,
  });
  neuroDeptId = neuro._id.toString();

  // Create Doctors
  const doctor = await UserModel.create({
    name: 'Dr. Gregory House',
    email: 'house@hospital.com',
    password: await hashPassword('Doctor@123'),
    role: ROLES.DOCTOR,
    department: cardio._id,
    specialization: 'Cardiology',
    isActive: true,
    isActivated: true,
  });
  doctorId = doctor._id.toString();
  doctorToken = generateAccessToken({ userId: doctorId, role: ROLES.DOCTOR });

  const otherDoctor = await UserModel.create({
    name: 'Dr. Eric Foreman',
    email: 'foreman@hospital.com',
    password: await hashPassword('Doctor@123'),
    role: ROLES.DOCTOR,
    department: neuro._id,
    specialization: 'Neurology',
    isActive: true,
    isActivated: true,
  });
  otherDoctorId = otherDoctor._id.toString();
  otherDoctorToken = generateAccessToken({ userId: otherDoctorId, role: ROLES.DOCTOR });

  // Create Receptionist
  const receptionist = await UserModel.create({
    name: 'Sarah Jenkins',
    email: 'receptionist@hospital.com',
    password: await hashPassword('Recep@123'),
    role: ROLES.RECEPTIONIST,
    department: cardio._id,
    isActive: true,
    isActivated: true,
  });
  receptionistUserId = receptionist._id.toString();
  receptionistToken = generateAccessToken({
    userId: receptionistUserId,
    role: ROLES.RECEPTIONIST,
  });

  // Create Patient
  const patient = await PatientModel.create({
    patientId: 'PT-TEST-0001',
    fullName: 'Jane Doe',
    phone: '+1 (555) 019-2831',
    normalizedPhone: '+15550192831',
    dateOfBirth: '1990-05-15',
    gender: 'FEMALE',
    registeredBy: receptionist._id,
    isActive: true,
  });
  patientId = patient._id.toString();

  // Configure Doctor's Schedule:
  // Tuesdays: 09:00 - 12:00, Break: 10:30 - 11:00, Slot Duration: 30 mins
  // Valid slots: 09:00-09:30, 09:30-10:00, 10:00-10:30, 11:00-11:30, 11:30-12:00 (5 slots)
  await ScheduleModel.create({
    doctor: doctorId,
    slotDuration: 30,
    isActive: true,
    workingDays: [
      {
        dayOfWeek: 2, // Tuesday
        dayName: 'TUESDAY',
        isEnabled: true,
        sessions: [{ startTime: '09:00', endTime: '12:00' }],
        breaks: [{ startTime: '10:30', endTime: '11:00' }],
      },
    ],
  });
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await AppointmentModel.deleteMany({});
});

describe('Phase 5 — Appointment Booking & Concurrency Protection', () => {
  describe('Successful Booking Flow', () => {
    it('books an appointment successfully with complete references', async () => {
      const payload = {
        patientId,
        doctorId,
        departmentId: cardioDeptId,
        date: FUTURE_TUESDAY,
        startTime: '09:00',
        endTime: '09:30',
        purpose: 'Routine cardiovascular checkup',
        notes: 'Patient reports mild shortness of breath upon exertion.',
      };

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(MESSAGES.APPOINTMENT_CREATED);

      const appt = res.body.data;
      expect(appt.id).toBeDefined();
      expect(appt.patient.fullName).toBe('Jane Doe');
      expect(appt.doctor.name).toBe('Dr. Gregory House');
      expect(appt.department.code).toBe('CARDIO');
      expect(appt.date).toBe(FUTURE_TUESDAY);
      expect(appt.startTime).toBe('09:00');
      expect(appt.endTime).toBe('09:30');
      expect(appt.status).toBe('CONFIRMED');
      expect(appt.purpose).toBe('Routine cardiovascular checkup');
      expect(appt.createdBy.id).toBe(receptionistUserId);
    });
  });

  describe('Validation & Edge Cases', () => {
    it('rejects booking if doctor does not belong to the selected department', async () => {
      const payload = {
        patientId,
        doctorId, // Belongs to Cardiology
        departmentId: neuroDeptId, // Mismatched Neurology department
        date: FUTURE_TUESDAY,
        startTime: '09:00',
        endTime: '09:30',
        purpose: 'Neurology exam with cardiology doctor',
      };

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(MESSAGES.APPOINTMENT_DOCTOR_MISMATCH_DEPT);
    });

    it('rejects booking for a non-existent patient', async () => {
      const fakePatientId = new mongoose.Types.ObjectId().toString();
      const payload = {
        patientId: fakePatientId,
        doctorId,
        departmentId: cardioDeptId,
        date: FUTURE_TUESDAY,
        startTime: '09:00',
        endTime: '09:30',
        purpose: 'Checkup',
      };

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send(payload);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe(MESSAGES.PATIENT_NOT_FOUND);
    });

    it('rejects booking on a day when doctor is not working (e.g., Wednesday)', async () => {
      // 2030-01-02 is Wednesday
      const wednesday = '2030-01-02';
      const payload = {
        patientId,
        doctorId,
        departmentId: cardioDeptId,
        date: wednesday,
        startTime: '09:00',
        endTime: '09:30',
        purpose: 'Checkup',
      };

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(MESSAGES.APPOINTMENT_DAY_OFF);
    });

    it('rejects booking outside working sessions (e.g. 08:00 or 12:30)', async () => {
      const payload = {
        patientId,
        doctorId,
        departmentId: cardioDeptId,
        date: FUTURE_TUESDAY,
        startTime: '08:00',
        endTime: '08:30',
        purpose: 'Early morning visit',
      };

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(MESSAGES.APPOINTMENT_OUTSIDE_SESSION);
    });

    it('rejects booking that falls within a scheduled break (10:30 - 11:00)', async () => {
      const payload = {
        patientId,
        doctorId,
        departmentId: cardioDeptId,
        date: FUTURE_TUESDAY,
        startTime: '10:30',
        endTime: '11:00',
        purpose: 'Visit during break',
      };

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(MESSAGES.APPOINTMENT_BREAK_CONFLICT);
    });

    it('rejects booking with an invalid slot duration (e.g. 15 mins instead of 30 mins)', async () => {
      const payload = {
        patientId,
        doctorId,
        departmentId: cardioDeptId,
        date: FUTURE_TUESDAY,
        startTime: '09:00',
        endTime: '09:15',
        purpose: 'Short visit',
      };

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(MESSAGES.APPOINTMENT_INVALID_DURATION);
    });

    it('rejects booking for past dates', async () => {
      const pastDate = '2020-01-07'; // Tuesday in past
      const payload = {
        patientId,
        doctorId,
        departmentId: cardioDeptId,
        date: pastDate,
        startTime: '09:00',
        endTime: '09:30',
        purpose: 'Past visit',
      };

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(MESSAGES.APPOINTMENT_PAST_DATE);
    });

    it('rejects duplicate booking for the same slot with 409 Conflict', async () => {
      const payload = {
        patientId,
        doctorId,
        departmentId: cardioDeptId,
        date: FUTURE_TUESDAY,
        startTime: '09:00',
        endTime: '09:30',
        purpose: 'First booking',
      };

      const firstRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send(payload);
      expect(firstRes.status).toBe(201);

      const secondRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          ...payload,
          purpose: 'Duplicate booking attempt',
        });

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.message).toBe(MESSAGES.APPOINTMENT_SLOT_ALREADY_BOOKED);
    });
  });

  describe('Double-Booking Concurrency Protection (Atomic Race Condition)', () => {
    it('guarantees that only ONE of simultaneous requests succeeds and exactly ONE receives 409 Conflict', async () => {
      const slot = {
        patientId,
        doctorId,
        departmentId: cardioDeptId,
        date: FUTURE_TUESDAY,
        startTime: '10:00',
        endTime: '10:30',
        purpose: 'Concurrent race booking',
      };

      // Two receptionists click "Book" at the exact same millisecond
      const [resA, resB] = await Promise.all([
        request(app)
          .post('/api/v1/appointments')
          .set('Authorization', `Bearer ${receptionistToken}`)
          .send({ ...slot, notes: 'Receptionist A request' }),
        request(app)
          .post('/api/v1/appointments')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ ...slot, notes: 'Receptionist B request' }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([201, 409]);

      const conflictRes = resA.status === 409 ? resA : resB;
      expect(conflictRes.body.success).toBe(false);
      expect(conflictRes.body.message).toBe(MESSAGES.APPOINTMENT_SLOT_ALREADY_BOOKED);

      // Verify database state: exactly ONE active appointment exists in MongoDB
      const dbAppointments = await AppointmentModel.find({
        doctor: doctorId,
        date: FUTURE_TUESDAY,
        startTime: '10:00',
        status: { $in: ['SCHEDULED', 'CONFIRMED'] },
      });
      expect(dbAppointments.length).toBe(1);
    });
  });

  describe('Cancellation Lifecycle & Slot Re-availability', () => {
    it('frees the slot upon cancellation while preserving historical appointment record', async () => {
      // 1. Book slot 09:30 - 10:00
      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId,
          doctorId,
          departmentId: cardioDeptId,
          date: FUTURE_TUESDAY,
          startTime: '09:30',
          endTime: '10:00',
          purpose: 'Consultation to be cancelled',
        });
      expect(bookRes.status).toBe(201);
      const apptId = bookRes.body.data.id;

      // 2. Check slots API -> 09:30 is BOOKED
      const slotsBefore = await request(app)
        .get(`/api/v1/slots?doctorId=${doctorId}&date=${FUTURE_TUESDAY}`)
        .set('Authorization', `Bearer ${receptionistToken}`);
      expect(slotsBefore.status).toBe(200);
      const slotBefore = slotsBefore.body.data.slots.find((s: { startTime: string }) => s.startTime === '09:30');
      expect(slotBefore.isAvailable).toBe(false);
      expect(slotBefore.reason).toBe('BOOKED');

      // 3. Cancel the appointment
      const cancelRes = await request(app)
        .patch(`/api/v1/appointments/${apptId}/cancel`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ reason: 'Patient called to reschedule due to emergency' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');
      expect(cancelRes.body.data.cancellationReason).toBe(
        'Patient called to reschedule due to emergency',
      );
      expect(cancelRes.body.data.cancelledAt).toBeDefined();

      // 4. Slots API should now show 09:30 as AVAILABLE
      const slotsAfter = await request(app)
        .get(`/api/v1/slots?doctorId=${doctorId}&date=${FUTURE_TUESDAY}`)
        .set('Authorization', `Bearer ${receptionistToken}`);
      expect(slotsAfter.status).toBe(200);
      const slotAfter = slotsAfter.body.data.slots.find((s: { startTime: string }) => s.startTime === '09:30');
      expect(slotAfter.isAvailable).toBe(true);

      // 5. Re-booking the exact same slot now succeeds (partial unique index ignores CANCELLED)
      const rebookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId,
          doctorId,
          departmentId: cardioDeptId,
          date: FUTURE_TUESDAY,
          startTime: '09:30',
          endTime: '10:00',
          purpose: 'New patient booked previously cancelled slot',
        });
      expect(rebookRes.status).toBe(201);

      // 6. Database contains 2 records for this slot: 1 CANCELLED, 1 CONFIRMED
      const totalRecords = await AppointmentModel.find({
        doctor: doctorId,
        date: FUTURE_TUESDAY,
        startTime: '09:30',
      });
      expect(totalRecords.length).toBe(2);

      // 7. Trying to cancel already cancelled appointment returns 400
      const doubleCancelRes = await request(app)
        .patch(`/api/v1/appointments/${apptId}/cancel`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ reason: 'Cancel again' });
      expect(doubleCancelRes.status).toBe(400);
      expect(doubleCancelRes.body.message).toBe(MESSAGES.APPOINTMENT_ALREADY_CANCELLED);
    });
  });

  describe('RBAC & Role-Specific Access', () => {
    it('allows a doctor to view their own appointment but blocks access to another doctor appointment with 403', async () => {
      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId,
          doctorId,
          departmentId: cardioDeptId,
          date: FUTURE_TUESDAY,
          startTime: '11:00',
          endTime: '11:30',
          purpose: 'Doctor House appointment',
        });
      expect(bookRes.status).toBe(201);
      const apptId = bookRes.body.data.id;

      // Doctor House views own appointment -> 200
      const ownRes = await request(app)
        .get(`/api/v1/appointments/${apptId}`)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(ownRes.status).toBe(200);
      expect(ownRes.body.data.id).toBe(apptId);

      // Doctor Foreman tries to view Doctor House appointment -> 403 Forbidden
      const forbiddenRes = await request(app)
        .get(`/api/v1/appointments/${apptId}`)
        .set('Authorization', `Bearer ${otherDoctorToken}`);
      expect(forbiddenRes.status).toBe(403);
    });

    it('lists appointments with query filters for receptionist', async () => {
      await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId,
          doctorId,
          departmentId: cardioDeptId,
          date: FUTURE_TUESDAY,
          startTime: '11:30',
          endTime: '12:00',
          purpose: 'Query filter test',
        });

      const listRes = await request(app)
        .get(`/api/v1/appointments?doctorId=${doctorId}&date=${FUTURE_TUESDAY}`)
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThan(0);
      expect(listRes.body.meta.total).toBeGreaterThan(0);
    });
  });
});
