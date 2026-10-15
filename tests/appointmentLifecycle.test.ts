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

process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-access-secret-key-min-32-characters-12345';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-key-min-32-characters-67890';
process.env['PORT'] = '5008';
process.env['MONGODB_URI'] = 'mongodb://localhost:27017/unused_for_appointment_lifecycle_test';
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
let universalPatientId: string;

const FUTURE_TUESDAY = '2030-01-01';

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  await UserModel.init();
  await DepartmentModel.init();
  await PatientModel.init();
  await ScheduleModel.init();
  await AppointmentModel.init();

  const { createApp } = await import('../src/app');
  app = createApp();

  // 1. Create Admin
  const admin = await UserModel.create({
    name: 'Super Admin',
    email: 'admin@hospital.com',
    password: await hashPassword('Admin@123'),
    role: ROLES.SUPER_ADMIN,
    isActive: true,
    isActivated: true,
  });
  adminToken = generateAccessToken({ userId: admin._id.toString(), role: ROLES.SUPER_ADMIN });

  // 2. Create Departments
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

  // 3. Create Doctors
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

  // 4. Create Receptionist assigned to Cardiology
  const receptionist = await UserModel.create({
    name: 'Receptionist Jane',
    email: 'jane@hospital.com',
    password: await hashPassword('Recept@123'),
    role: ROLES.RECEPTIONIST,
    department: cardio._id,
    isActive: true,
    isActivated: true,
  });
  receptionistToken = generateAccessToken({
    userId: receptionist._id.toString(),
    role: ROLES.RECEPTIONIST,
  });

  // 5. Create Schedules for both doctors (Tuesday is dayOfWeek: 2)
  await ScheduleModel.create({
    doctor: doctor._id,
    slotDuration: 30,
    workingDays: [
      {
        dayOfWeek: 2,
        dayName: 'TUESDAY',
        isEnabled: true,
        sessions: [{ startTime: '09:00', endTime: '17:00' }],
        breaks: [{ startTime: '12:00', endTime: '13:00' }],
      },
    ],
    isActive: true,
  });

  await ScheduleModel.create({
    doctor: otherDoctor._id,
    slotDuration: 30,
    workingDays: [
      {
        dayOfWeek: 2,
        dayName: 'TUESDAY',
        isEnabled: true,
        sessions: [{ startTime: '09:00', endTime: '17:00' }],
        breaks: [{ startTime: '12:00', endTime: '13:00' }],
      },
    ],
    isActive: true,
  });

  // 6. Create Patients
  const patient = await PatientModel.create({
    patientId: 'PT-2026-0001',
    fullName: 'John Doe',
    phone: '+1 (555) 019-2831',
    normalizedPhone: '+15550192831',
    dateOfBirth: '1985-06-15',
    gender: 'MALE',
    address: '123 Main St',
    department: cardio._id,
    registeredBy: receptionist._id,
    isActive: true,
  });
  patientId = patient._id.toString();

  // Patient registered in Neurology to test universal cross-department booking
  const patientNeuro = await PatientModel.create({
    patientId: 'PT-2026-0002',
    fullName: 'Alice Smith',
    phone: '+1 (555) 019-2832',
    normalizedPhone: '+15550192832',
    dateOfBirth: '1990-01-01',
    gender: 'FEMALE',
    address: '456 Elm St',
    department: neuro._id,
    registeredBy: receptionist._id,
    isActive: true,
  });
  universalPatientId = patientNeuro._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await AppointmentModel.deleteMany({});
});

describe('Phase 6 — Appointment Lifecycle & Doctor Workflow', () => {
  describe('Receptionist Department Scoping & Universal Patients', () => {
    it('automatically uses receptionist assigned department when departmentId is omitted', async () => {
      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId,
          doctorId,
          date: FUTURE_TUESDAY,
          startTime: '09:00',
          endTime: '09:30',
          purpose: 'Cardiology routine visit',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.department.id).toBe(cardioDeptId);
      expect(res.body.data.department.code).toBe('CARDIO');
    });

    it('rejects receptionist if they attempt to book for another department', async () => {
      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId,
          doctorId: otherDoctorId,
          departmentId: neuroDeptId,
          date: FUTURE_TUESDAY,
          startTime: '09:00',
          endTime: '09:30',
          purpose: 'Attempting to book foreign department',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('allows super admin to book appointments in any department', async () => {
      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patientId,
          doctorId: otherDoctorId,
          departmentId: neuroDeptId,
          date: FUTURE_TUESDAY,
          startTime: '09:00',
          endTime: '09:30',
          purpose: 'Admin booking Neurology consultation',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.department.id).toBe(neuroDeptId);
    });

    it('allows a patient registered in Neurology to be booked in Cardiology (universal patient record)', async () => {
      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId: universalPatientId,
          doctorId,
          date: FUTURE_TUESDAY,
          startTime: '09:00',
          endTime: '09:30',
          purpose: 'Neurology patient visiting Cardiology',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.patient.id).toBe(universalPatientId);
      expect(res.body.data.department.id).toBe(cardioDeptId);
    });
  });

  describe('Appointment Status Lifecycle: SCHEDULED -> ARRIVED -> COMPLETED', () => {
    it('successfully transitions from SCHEDULED/CONFIRMED to ARRIVED and then to COMPLETED', async () => {
      // 1. Create appointment
      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId,
          doctorId,
          date: FUTURE_TUESDAY,
          startTime: '09:00',
          endTime: '09:30',
          purpose: 'Chest pain evaluation',
        });
      expect(bookRes.status).toBe(201);
      const apptId = bookRes.body.data.id;
      expect(bookRes.body.data.status).toBe('CONFIRMED');

      // 2. Mark as Arrived (Receptionist check-in)
      const arriveRes = await request(app)
        .patch(`/api/v1/appointments/${apptId}/arrive`)
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(arriveRes.status).toBe(200);
      expect(arriveRes.body.data.status).toBe('ARRIVED');
      expect(arriveRes.body.data.arrivedAt).toBeDefined();
      expect(arriveRes.body.data.arrivedBy.name).toBe('Receptionist Jane');

      // 3. Complete appointment by Doctor with consultation notes
      const completeRes = await request(app)
        .patch(`/api/v1/appointments/${apptId}/complete`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          consultationNotes: 'ECG normal. Prescribed lifestyle changes and follow-up in 3 months.',
        });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.status).toBe('COMPLETED');
      expect(completeRes.body.data.completedAt).toBeDefined();
      expect(completeRes.body.data.completedBy.name).toBe('Dr. Gregory House');
      expect(completeRes.body.data.consultationNotes).toBe(
        'ECG normal. Prescribed lifestyle changes and follow-up in 3 months.',
      );
    });

    it('enforces terminal state protection: cannot reopen or re-arrive a COMPLETED appointment', async () => {
      // 1. Book & Mark arrived
      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId,
          doctorId,
          date: FUTURE_TUESDAY,
          startTime: '09:30',
          endTime: '10:00',
          purpose: 'Follow up',
        });
      const apptId = bookRes.body.data.id;

      await request(app)
        .patch(`/api/v1/appointments/${apptId}/arrive`)
        .set('Authorization', `Bearer ${receptionistToken}`);

      // Complete
      await request(app)
        .patch(`/api/v1/appointments/${apptId}/complete`)
        .set('Authorization', `Bearer ${doctorToken}`);

      // Cannot mark arrived again
      const reArriveRes = await request(app)
        .patch(`/api/v1/appointments/${apptId}/arrive`)
        .set('Authorization', `Bearer ${receptionistToken}`);
      expect(reArriveRes.status).toBe(400);

      // Cannot cancel completed appointment
      const cancelRes = await request(app)
        .patch(`/api/v1/appointments/${apptId}/cancel`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ reason: 'Patient changed mind' });
      expect(cancelRes.status).toBe(400);

      // Cannot reschedule completed appointment
      const rescheduleRes = await request(app)
        .patch(`/api/v1/appointments/${apptId}/reschedule`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          date: FUTURE_TUESDAY,
          startTime: '10:00',
          endTime: '10:30',
          reason: 'Try to move completed',
        });
      expect(rescheduleRes.status).toBe(400);
    });

    it('enforces terminal state protection on CANCELLED appointments', async () => {
      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId,
          doctorId,
          date: FUTURE_TUESDAY,
          startTime: '10:00',
          endTime: '10:30',
          purpose: 'Cancellation test',
        });
      const apptId = bookRes.body.data.id;

      // Cancel
      const cancelRes = await request(app)
        .patch(`/api/v1/appointments/${apptId}/cancel`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ reason: 'Patient called to cancel' });
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');

      // Attempt to arrive cancelled appointment -> 400
      const arriveRes = await request(app)
        .patch(`/api/v1/appointments/${apptId}/arrive`)
        .set('Authorization', `Bearer ${receptionistToken}`);
      expect(arriveRes.status).toBe(400);

      // Attempt to complete cancelled appointment -> 400
      const completeRes = await request(app)
        .patch(`/api/v1/appointments/${apptId}/complete`)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(completeRes.status).toBe(400);
    });
  });

  describe('Doctor Workflow & Privacy Protection', () => {
    it('blocks a doctor from completing another doctor appointment with 403 Forbidden', async () => {
      // Doctor House appointment
      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId,
          doctorId,
          date: FUTURE_TUESDAY,
          startTime: '10:30',
          endTime: '11:00',
          purpose: 'House clinic',
        });
      const apptId = bookRes.body.data.id;

      // Doctor Foreman attempts to complete Doctor House appointment -> 403
      const unauthorizedComplete = await request(app)
        .patch(`/api/v1/appointments/${apptId}/complete`)
        .set('Authorization', `Bearer ${otherDoctorToken}`)
        .send({ consultationNotes: 'Unauthorized attempt' });

      expect(unauthorizedComplete.status).toBe(403);
    });

    it('allows only the assigned doctor to update consultation notes', async () => {
      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId,
          doctorId,
          date: FUTURE_TUESDAY,
          startTime: '11:00',
          endTime: '11:30',
          purpose: 'Consultation notes test',
        });
      const apptId = bookRes.body.data.id;

      // Other doctor blocked -> 403
      const forbiddenNotes = await request(app)
        .patch(`/api/v1/appointments/${apptId}/consultation`)
        .set('Authorization', `Bearer ${otherDoctorToken}`)
        .send({ consultationNotes: 'Intrusion note' });
      expect(forbiddenNotes.status).toBe(403);

      // Assigned doctor succeeds -> 200
      const validNotes = await request(app)
        .patch(`/api/v1/appointments/${apptId}/consultation`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ consultationNotes: 'Patient showed marked improvement.' });
      expect(validNotes.status).toBe(200);
      expect(validNotes.body.data.consultationNotes).toBe('Patient showed marked improvement.');
    });
  });

  describe('Rescheduling & Slot Release', () => {
    it('records previous slot in rescheduleHistory and frees old slot for re-booking', async () => {
      // 1. Book initial slot: 09:00 - 09:30
      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId,
          doctorId,
          date: FUTURE_TUESDAY,
          startTime: '09:00',
          endTime: '09:30',
          purpose: 'Initial booking to be rescheduled',
        });
      expect(bookRes.status).toBe(201);
      const apptId = bookRes.body.data.id;

      // 2. Reschedule to 09:30 - 10:00
      const rescheduleRes = await request(app)
        .patch(`/api/v1/appointments/${apptId}/reschedule`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          date: FUTURE_TUESDAY,
          startTime: '09:30',
          endTime: '10:00',
          reason: 'Patient requested afternoon time slot',
        });

      expect(rescheduleRes.status).toBe(200);
      expect(rescheduleRes.body.data.startTime).toBe('09:30');
      expect(rescheduleRes.body.data.endTime).toBe('10:00');
      expect(rescheduleRes.body.data.rescheduleHistory.length).toBe(1);
      expect(rescheduleRes.body.data.rescheduleHistory[0].previousStartTime).toBe('09:00');
      expect(rescheduleRes.body.data.rescheduleHistory[0].previousEndTime).toBe('09:30');
      expect(rescheduleRes.body.data.rescheduleHistory[0].reason).toBe(
        'Patient requested afternoon time slot',
      );

      // 3. Verify old slot (09:00 - 09:30) is now completely freed and can be booked by universal patient
      const newBookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId: universalPatientId,
          doctorId,
          date: FUTURE_TUESDAY,
          startTime: '09:00',
          endTime: '09:30',
          purpose: 'New booking claiming freed slot',
        });
      expect(newBookRes.status).toBe(201);
      expect(newBookRes.body.data.startTime).toBe('09:00');
    });

    it('updates appointment purpose and notes via PATCH /:id', async () => {
      const bookRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          patientId,
          doctorId,
          date: FUTURE_TUESDAY,
          startTime: '10:00',
          endTime: '10:30',
          purpose: 'Original Purpose',
          notes: 'Original Notes',
        });
      const apptId = bookRes.body.data.id;

      const updateRes = await request(app)
        .patch(`/api/v1/appointments/${apptId}`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          purpose: 'Updated Purpose Text',
          notes: 'Updated Notes Information',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.purpose).toBe('Updated Purpose Text');
      expect(updateRes.body.data.notes).toBe('Updated Notes Information');
    });
  });
});
