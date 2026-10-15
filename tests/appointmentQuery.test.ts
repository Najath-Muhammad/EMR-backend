import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Application } from 'express';
import { ROLES } from '../src/constants/roles';
import { UserModel } from '../src/models/User.model';
import { DepartmentModel } from '../src/models/Department.model';
import { PatientModel } from '../src/models/Patient.model';
import { AppointmentModel } from '../src/models/Appointment.model';
import { hashPassword } from '../src/utils/password.util';
import { generateAccessToken } from '../src/utils/token.util';

process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-access-secret-key-min-32-characters-12345';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-key-min-32-characters-67890';
process.env['PORT'] = '5008';
process.env['MONGODB_URI'] = 'mongodb://localhost:27017/unused_for_query_test';
process.env['HOSPITAL_TIMEZONE'] = 'UTC';

let app: Application;
let mongoServer: MongoMemoryServer;

let adminToken: string;
let receptionistToken: string;
let doctorHouseToken: string;
let doctorForemanToken: string;

let cardioDeptId: string;
let neuroDeptId: string;
let doctorHouseId: string;
let doctorForemanId: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  await UserModel.init();
  await DepartmentModel.init();
  await PatientModel.init();
  await AppointmentModel.init();

  const { createApp } = await import('../src/app');
  app = createApp();

  // 1. Super Admin
  const admin = await UserModel.create({
    name: 'Super Admin',
    email: 'admin@hospital.com',
    password: await hashPassword('Admin@123'),
    role: ROLES.SUPER_ADMIN,
    isActive: true,
    isActivated: true,
  });
  adminToken = generateAccessToken({ userId: admin._id.toString(), role: ROLES.SUPER_ADMIN });

  // 2. Departments
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

  // 3. Doctors
  const doctorHouse = await UserModel.create({
    name: 'Dr. Gregory House',
    email: 'house@hospital.com',
    password: await hashPassword('Doctor@123'),
    role: ROLES.DOCTOR,
    department: cardio._id,
    specialization: 'Cardiology',
    isActive: true,
    isActivated: true,
  });
  doctorHouseId = doctorHouse._id.toString();
  doctorHouseToken = generateAccessToken({ userId: doctorHouseId, role: ROLES.DOCTOR });

  const doctorForeman = await UserModel.create({
    name: 'Dr. Eric Foreman',
    email: 'foreman@hospital.com',
    password: await hashPassword('Doctor@123'),
    role: ROLES.DOCTOR,
    department: neuro._id,
    specialization: 'Neurology',
    isActive: true,
    isActivated: true,
  });
  doctorForemanId = doctorForeman._id.toString();
  doctorForemanToken = generateAccessToken({ userId: doctorForemanId, role: ROLES.DOCTOR });

  // 4. Receptionist (assigned to Cardiology)
  const receptionist = await UserModel.create({
    name: 'Sarah Jenkins',
    email: 'receptionist@hospital.com',
    password: await hashPassword('Recep@123'),
    role: ROLES.RECEPTIONIST,
    department: cardio._id,
    isActive: true,
    isActivated: true,
  });
  receptionistToken = generateAccessToken({
    userId: receptionist._id.toString(),
    role: ROLES.RECEPTIONIST,
  });

  // 5. Patients
  const patientJohn = await PatientModel.create({
    patientId: 'PAT-2026-00001',
    fullName: 'Johnathan Doe',
    phone: '+1 (555) 111-2222',
    normalizedPhone: '+15551112222',
    dateOfBirth: '1985-03-20',
    gender: 'MALE',
    registeredBy: receptionist._id,
    isActive: true,
  });

  const patientAlice = await PatientModel.create({
    patientId: 'PAT-2026-00002',
    fullName: 'Alice Smith',
    phone: '+1 (555) 333-4444',
    normalizedPhone: '+15553334444',
    dateOfBirth: '1992-07-11',
    gender: 'FEMALE',
    registeredBy: receptionist._id,
    isActive: true,
  });

  const patientBob = await PatientModel.create({
    patientId: 'PAT-2026-00003',
    fullName: 'Bob Johnson',
    phone: '+1 (555) 555-6666',
    normalizedPhone: '+15555556666',
    dateOfBirth: '1978-11-05',
    gender: 'MALE',
    registeredBy: receptionist._id,
    isActive: true,
  });

  // 6. Appointments
  // Appt 1: Dr House (Cardio), John Doe, 2030-01-01 09:00, CONFIRMED
  await AppointmentModel.create({
    doctor: doctorHouse._id,
    patient: patientJohn._id,
    patientName: patientJohn.fullName,
    department: cardio._id,
    date: '2030-01-01',
    startTime: '09:00',
    endTime: '09:30',
    status: 'CONFIRMED',
    purpose: 'Cardiac checkup',
    createdBy: receptionist._id,
  });

  // Appt 2: Dr House (Cardio), Alice Smith, 2030-01-01 09:30, ARRIVED
  await AppointmentModel.create({
    doctor: doctorHouse._id,
    patient: patientAlice._id,
    patientName: patientAlice.fullName,
    department: cardio._id,
    date: '2030-01-01',
    startTime: '09:30',
    endTime: '10:00',
    status: 'ARRIVED',
    purpose: 'Hypertension consultation',
    createdBy: receptionist._id,
  });

  // Appt 3: Dr House (Cardio), Bob Johnson, 2030-01-02 10:00, COMPLETED
  await AppointmentModel.create({
    doctor: doctorHouse._id,
    patient: patientBob._id,
    patientName: patientBob.fullName,
    department: cardio._id,
    date: '2030-01-02',
    startTime: '10:00',
    endTime: '10:30',
    status: 'COMPLETED',
    purpose: 'Routine ECG review',
    createdBy: receptionist._id,
  });

  // Appt 4: Dr Foreman (Neuro), John Doe, 2030-01-02 11:00, CANCELLED
  await AppointmentModel.create({
    doctor: doctorForeman._id,
    patient: patientJohn._id,
    patientName: patientJohn.fullName,
    department: neuro._id,
    date: '2030-01-02',
    startTime: '11:00',
    endTime: '11:30',
    status: 'CANCELLED',
    purpose: 'Migraine assessment',
    createdBy: admin._id,
  });

  // Appt 5: Dr Foreman (Neuro), Alice Smith, 2030-01-03 14:00, SCHEDULED
  await AppointmentModel.create({
    doctor: doctorForeman._id,
    patient: patientAlice._id,
    patientName: patientAlice.fullName,
    department: neuro._id,
    date: '2030-01-03',
    startTime: '14:00',
    endTime: '14:30',
    status: 'SCHEDULED',
    purpose: 'Nerve conduction study',
    createdBy: admin._id,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Phase 7 — Server-Side Querying, Filtering, Sorting, and Pagination', () => {
  describe('Patient Multi-Field Search', () => {
    it('searches appointments by patient name (case-insensitive partial match)', async () => {
      const res = await request(app)
        .get('/api/v1/appointments?search=johnathan')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2); // Johnathan Doe has Appt 1 and Appt 4
      expect(res.body.meta.total).toBe(2);
      expect(res.body.data.every((a: { patient: { fullName: string } }) => a.patient.fullName.includes('Johnathan'))).toBe(true);
    });

    it('searches appointments by unique Patient ID', async () => {
      const res = await request(app)
        .get('/api/v1/appointments?search=PAT-2026-00002')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2); // Alice Smith has Appt 2 and Appt 5
      expect(res.body.meta.total).toBe(2);
      expect(res.body.data.every((a: { patient: { patientId: string } }) => a.patient.patientId === 'PAT-2026-00002')).toBe(true);
    });

    it('searches appointments by patient mobile phone number', async () => {
      const res = await request(app)
        .get('/api/v1/appointments?search=5556666')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1); // Bob Johnson has Appt 3
      expect(res.body.meta.total).toBe(1);
      expect(res.body.data[0].patient.fullName).toBe('Bob Johnson');
    });

    it('returns empty list gracefully when search term matches no patients', async () => {
      const res = await request(app)
        .get('/api/v1/appointments?search=NonExistentPatientXYZ')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
      expect(res.body.meta.totalPages).toBe(1);
    });
  });

  describe('Filtering by Doctor, Department, and Status', () => {
    it('filters appointments by doctorId', async () => {
      const res = await request(app)
        .get(`/api/v1/appointments?doctorId=${doctorHouseId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.meta.total).toBe(3);
      expect(res.body.data.every((a: { doctor: { id: string } }) => a.doctor.id === doctorHouseId)).toBe(true);
    });

    it('filters appointments by departmentId', async () => {
      const res = await request(app)
        .get(`/api/v1/appointments?departmentId=${neuroDeptId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.data.every((a: { department: { id: string } }) => a.department.id === neuroDeptId)).toBe(true);
    });

    it('filters appointments by status', async () => {
      const res = await request(app)
        .get('/api/v1/appointments?status=ARRIVED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('ARRIVED');
      expect(res.body.data[0].patient.fullName).toBe('Alice Smith');
    });
  });

  describe('Date Range Filtering & Validation', () => {
    it('filters appointments by startDate and endDate', async () => {
      const res = await request(app)
        .get('/api/v1/appointments?startDate=2030-01-01&endDate=2030-01-01')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every((a: { date: string }) => a.date === '2030-01-01')).toBe(true);
    });

    it('supports backwards-compatible fromDate and toDate query parameters', async () => {
      const res = await request(app)
        .get('/api/v1/appointments?fromDate=2030-01-02&toDate=2030-01-03')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3); // Appts 3, 4, 5
    });

    it('rejects invalid date range where startDate is after endDate with 422', async () => {
      const res = await request(app)
        .get('/api/v1/appointments?startDate=2030-01-05&endDate=2030-01-01')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Start date must be on or before end date');
    });
  });

  describe('Whitelisted Sorting', () => {
    it('sorts appointments by date in ascending order by default', async () => {
      const res = await request(app)
        .get('/api/v1/appointments?sortBy=date&sortOrder=asc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const dates = res.body.data.map((a: { date: string }) => a.date);
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i] >= dates[i - 1]).toBe(true);
      }
    });

    it('sorts appointments by date in descending order', async () => {
      const res = await request(app)
        .get('/api/v1/appointments?sortBy=date&sortOrder=desc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const dates = res.body.data.map((a: { date: string }) => a.date);
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i] <= dates[i - 1]).toBe(true);
      }
    });

    it('sorts appointments by status', async () => {
      const res = await request(app)
        .get('/api/v1/appointments?sortBy=status&sortOrder=asc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(5);
    });

    it('rejects unwhitelisted sort fields with 422', async () => {
      const res = await request(app)
        .get('/api/v1/appointments?sortBy=unauthorizedField')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Server-Side Pagination & Boundaries', () => {
    it('paginates results with page and limit boundaries', async () => {
      const page1 = await request(app)
        .get('/api/v1/appointments?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(page1.status).toBe(200);
      expect(page1.body.data).toHaveLength(2);
      expect(page1.body.meta.page).toBe(1);
      expect(page1.body.meta.limit).toBe(2);
      expect(page1.body.meta.total).toBe(5);
      expect(page1.body.meta.totalPages).toBe(3);

      const page2 = await request(app)
        .get('/api/v1/appointments?page=2&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(page2.status).toBe(200);
      expect(page2.body.data).toHaveLength(2);
      expect(page2.body.meta.page).toBe(2);

      const page3 = await request(app)
        .get('/api/v1/appointments?page=3&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(page3.status).toBe(200);
      expect(page3.body.data).toHaveLength(1);
      expect(page3.body.meta.page).toBe(3);
    });

    it('enforces maximum page size limit and rejects limit > 100 with 422', async () => {
      const res = await request(app)
        .get('/api/v1/appointments?limit=101')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Role-Based Security & Isolation', () => {
    it('scopes Doctor queries exclusively to own appointments', async () => {
      const res = await request(app)
        .get('/api/v1/appointments')
        .set('Authorization', `Bearer ${doctorHouseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.data.every((a: { doctor: { id: string } }) => a.doctor.id === doctorHouseId)).toBe(true);
    });

    it('scopes Dr. Foreman queries exclusively to his own appointments', async () => {
      const res = await request(app)
        .get('/api/v1/appointments')
        .set('Authorization', `Bearer ${doctorForemanToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every((a: { doctor: { id: string } }) => a.doctor.id === doctorForemanId)).toBe(true);
    });

    it('rejects Doctor attempt to query another doctor appointments with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/appointments?doctorId=${doctorForemanId}`)
        .set('Authorization', `Bearer ${doctorHouseToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('scopes Receptionist queries exclusively to assigned department', async () => {
      const res = await request(app)
        .get('/api/v1/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.data.every((a: { department: { id: string } }) => a.department.id === cardioDeptId)).toBe(true);
    });

    it('rejects Receptionist attempt to query another department with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/appointments?departmentId=${neuroDeptId}`)
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('assigned department');
    });

    it('allows Super Admin to query across departments and doctors', async () => {
      const res = await request(app)
        .get('/api/v1/appointments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(5);
      expect(res.body.meta.total).toBe(5);
    });
  });
});
