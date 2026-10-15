import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Application } from 'express';
import { ROLES } from '../src/constants/roles';
import { UserModel } from '../src/models/User.model';
import { DepartmentModel } from '../src/models/Department.model';
import { PatientModel } from '../src/models/Patient.model';
import { CounterModel } from '../src/models/Counter.model';
import { hashPassword } from '../src/utils/password.util';
import { generateAccessToken } from '../src/utils/token.util';

process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-access-secret-key-min-32-characters-12345';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-key-min-32-characters-67890';
process.env['PORT'] = '5005';
process.env['MONGODB_URI'] = 'mongodb://localhost:27017/unused_for_patient_test';
process.env['SUPER_ADMIN_EMAIL'] = 'admin@hospital.com';

let app: Application;
let mongoServer: MongoMemoryServer;
let adminToken: string;
let receptionistToken: string;
let doctorToken: string;
let testDeptId: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  await UserModel.init();
  await DepartmentModel.init();
  await PatientModel.init();
  await CounterModel.init();

  const { createApp } = await import('../src/app');
  app = createApp();

  // Create Super Admin
  const admin = await UserModel.create({
    name: 'Super Admin',
    email: 'admin@hospital.com',
    password: await hashPassword('Admin@123'),
    role: ROLES.SUPER_ADMIN,
    isActive: true,
    isActivated: true,
  });
  adminToken = generateAccessToken({ userId: admin._id.toString(), role: ROLES.SUPER_ADMIN });

  // Create Department
  const dept = await DepartmentModel.create({
    name: 'Cardiology',
    code: 'CARD',
    isActive: true,
  });
  testDeptId = dept._id.toString();

  // Create Receptionist
  const receptionist = await UserModel.create({
    name: 'Sarah Receptionist',
    email: 'sarah@hospital.com',
    password: await hashPassword('Reception@123'),
    role: ROLES.RECEPTIONIST,
    department: dept._id,
    isActive: true,
    isActivated: true,
  });
  receptionistToken = generateAccessToken({
    userId: receptionist._id.toString(),
    role: ROLES.RECEPTIONIST,
  });

  // Create Doctor
  const doctor = await UserModel.create({
    name: 'Dr. Gregory House',
    email: 'house@hospital.com',
    password: await hashPassword('Doctor@123'),
    role: ROLES.DOCTOR,
    department: dept._id,
    isActive: true,
    isActivated: true,
  });
  doctorToken = generateAccessToken({ userId: doctor._id.toString(), role: ROLES.DOCTOR });
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await PatientModel.deleteMany({});
  await CounterModel.deleteMany({});
});

describe('Patient Management Integration Tests (Phase 4)', () => {
  const samplePatient = {
    fullName: 'Robert Chase',
    phone: '+1 (555) 234-5678',
    dateOfBirth: '1985-07-14',
    gender: 'MALE',
    email: 'chase@example.com',
    address: '123 Baker Street',
    bloodGroup: 'O+',
    registrationDepartment: '',
  };

  describe('POST /api/v1/patients (Registration & Patient ID)', () => {
    it('allows Receptionist to register a patient and automatically generates a unique sequential patientId', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ ...samplePatient, registrationDepartment: testDeptId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.patientId).toMatch(/^PAT-\d{4}-\d{5}$/);
      expect(res.body.data.fullName).toBe('Robert Chase');
      expect(res.body.data.phone).toBe('+1 (555) 234-5678');
      expect(res.body.data.normalizedPhone).toBe('5552345678');
      expect(res.body.data.registrationDepartment).toBeDefined();
      expect(res.body.data.registrationDepartment.code).toBe('CARD');
    });

    it('generates sequential collision-free patient IDs for consecutive registrations', async () => {
      const res1 = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ ...samplePatient, fullName: 'Patient One', phone: '555-1111' });

      const res2 = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ ...samplePatient, fullName: 'Patient Two', phone: '555-2222' });

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res1.body.data.patientId).not.toBe(res2.body.data.patientId);
      expect(res1.body.data.patientId.slice(-5)).toBe('00001');
      expect(res2.body.data.patientId.slice(-5)).toBe('00002');
    });

    it('allows shared mobile numbers for different family members (Rule 5)', async () => {
      // Register Parent
      const resParent = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          fullName: 'John Senior',
          phone: '555-987-6543',
          dateOfBirth: '1960-01-01',
          gender: 'MALE',
        });

      // Register Child with identical phone number
      const resChild = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          fullName: 'John Junior',
          phone: '555-987-6543', // Shared family phone
          dateOfBirth: '2005-05-15',
          gender: 'MALE',
        });

      expect(resParent.status).toBe(201);
      expect(resChild.status).toBe(201);
      expect(resParent.body.data.id).not.toBe(resChild.body.data.id);
      expect(resParent.body.data.patientId).not.toBe(resChild.body.data.patientId);
      expect(resParent.body.data.normalizedPhone).toBe(resChild.body.data.normalizedPhone);
    });

    it('rejects registration with invalid date of birth (future date)', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ ...samplePatient, dateOfBirth: '2099-01-01' });

      expect(res.status).toBe(422);
      expect(res.body.message).toContain('Date of birth cannot be in the future');
    });

    it('rejects DOCTOR from registering new patients (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(samplePatient);

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated requests (401 Unauthorized)', async () => {
      const res = await request(app).post('/api/v1/patients').send(samplePatient);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/patients/check-duplicates', () => {
    beforeEach(async () => {
      // Seed an existing patient
      await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          fullName: 'Alice Walker',
          phone: '+1 (555) 777-8888',
          dateOfBirth: '1990-03-25',
          gender: 'FEMALE',
        });
    });

    it('detects potential duplicate when phone number matches even with different formatting', async () => {
      const res = await request(app)
        .post('/api/v1/patients/check-duplicates')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          fullName: 'Alice W.',
          phone: '5557778888', // Unformatted input
          dateOfBirth: '1990-03-25',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.hasMatches).toBe(true);
      expect(res.body.data.duplicates).toHaveLength(1);
      expect(res.body.data.duplicates[0].confidence).toBe('HIGH');
      expect(res.body.data.duplicates[0].matchReasons[0]).toContain('Matches mobile phone number');
    });

    it('detects potential duplicate when full name and date of birth match', async () => {
      const res = await request(app)
        .post('/api/v1/patients/check-duplicates')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          fullName: 'alice walker', // case-insensitive match
          phone: '555-999-0000',     // different phone
          dateOfBirth: '1990-03-25',  // matching DOB
        });

      expect(res.status).toBe(200);
      expect(res.body.data.hasMatches).toBe(true);
      expect(res.body.data.duplicates).toHaveLength(1);
      expect(res.body.data.duplicates[0].matchReasons[0]).toContain('Exact match on full name and date of birth');
    });

    it('never treats matching name alone as proof of duplicate (Rule 4)', async () => {
      // Different phone and different DOB (e.g. two people named Alice Walker)
      const res = await request(app)
        .post('/api/v1/patients/check-duplicates')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          fullName: 'Alice Walker',
          phone: '555-123-9999',     // completely different phone
          dateOfBirth: '1975-11-12',  // completely different DOB
        });

      expect(res.status).toBe(200);
      // Name alone is NOT flagged as a duplicate match
      expect(res.body.data.hasMatches).toBe(false);
      expect(res.body.data.duplicates).toHaveLength(0);
    });

    it('returns hasMatches: false when no matching records exist', async () => {
      const res = await request(app)
        .post('/api/v1/patients/check-duplicates')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          fullName: 'Totally Unique Person',
          phone: '555-000-1122',
          dateOfBirth: '1999-12-31',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.hasMatches).toBe(false);
      expect(res.body.data.duplicates).toHaveLength(0);
    });
  });

  describe('GET /api/v1/patients (Searching & Listing)', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          fullName: 'Michael Scott',
          phone: '+1 (555) 321-4567',
          dateOfBirth: '1965-03-15',
          gender: 'MALE',
          email: 'scott@dundermifflin.com',
        });

      await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          fullName: 'Dwight Schrute',
          phone: '+1 (555) 654-7890',
          dateOfBirth: '1970-01-20',
          gender: 'MALE',
          email: 'dwight@beetfarm.com',
        });
    });

    it('searches patients by patientId', async () => {
      const allRes = await request(app)
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`);

      const firstPatientId = allRes.body.data[0].patientId;

      const searchRes = await request(app)
        .get(`/api/v1/patients?search=${firstPatientId}`)
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data).toHaveLength(1);
      expect(searchRes.body.data[0].patientId).toBe(firstPatientId);
    });

    it('searches patients by normalized phone number', async () => {
      // Search with unformatted partial digits
      const searchRes = await request(app)
        .get('/api/v1/patients?search=3214567')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data).toHaveLength(1);
      expect(searchRes.body.data[0].fullName).toBe('Michael Scott');
    });

    it('searches patients by name (case-insensitive)', async () => {
      const searchRes = await request(app)
        .get('/api/v1/patients?search=schrute')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data).toHaveLength(1);
      expect(searchRes.body.data[0].fullName).toBe('Dwight Schrute');
    });

    it('allows DOCTOR to view and search patient list (read-only)', async () => {
      const searchRes = await request(app)
        .get('/api/v1/patients?search=Michael')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data).toHaveLength(1);
      expect(searchRes.body.data[0].fullName).toBe('Michael Scott');
    });
  });

  describe('GET /api/v1/patients/:id & PUT /api/v1/patients/:id', () => {
    it('retrieves patient by MongoDB _id or human-readable patientId', async () => {
      const createRes = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send(samplePatient);

      const patientMongoId = createRes.body.data.id;
      const humanPatientId = createRes.body.data.patientId;

      const resById = await request(app)
        .get(`/api/v1/patients/${patientMongoId}`)
        .set('Authorization', `Bearer ${receptionistToken}`);
      expect(resById.status).toBe(200);
      expect(resById.body.data.fullName).toBe('Robert Chase');

      const resByHumanId = await request(app)
        .get(`/api/v1/patients/${humanPatientId}`)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(resByHumanId.status).toBe(200);
      expect(resByHumanId.body.data.fullName).toBe('Robert Chase');
    });

    it('allows Receptionist to update patient details', async () => {
      const createRes = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send(samplePatient);

      const patientId = createRes.body.data.id;

      const updateRes = await request(app)
        .put(`/api/v1/patients/${patientId}`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          address: '456 Elm Avenue, Suite 12',
          bloodGroup: 'AB+',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.address).toBe('456 Elm Avenue, Suite 12');
      expect(updateRes.body.data.bloodGroup).toBe('AB+');
    });

    it('allows Super Admin to retrieve patient records', async () => {
      const res = await request(app)
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
