import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Application } from 'express';
import { ROLES } from '../src/constants/roles';
import { UserModel } from '../src/models/User.model';
import { DepartmentModel } from '../src/models/Department.model';
import { hashPassword } from '../src/utils/password.util';
import { generateAccessToken } from '../src/utils/token.util';

process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-access-secret-key-min-32-characters-12345';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-key-min-32-characters-67890';
process.env['PORT'] = '5004';
process.env['MONGODB_URI'] = 'mongodb://localhost:27017/unused_for_staff_test';
process.env['SUPER_ADMIN_EMAIL'] = 'admin@hospital.com';

let app: Application;
let mongoServer: MongoMemoryServer;
let adminToken: string;
let doctorToken: string;
let testDeptId: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  await UserModel.init();
  await DepartmentModel.init();

  const { createApp } = await import('../src/app');
  app = createApp();

  const adminUser = await UserModel.create({
    name: 'Super Admin',
    email: 'admin@hospital.com',
    password: await hashPassword('Admin@123'),
    role: ROLES.SUPER_ADMIN,
    isActive: true,
    isActivated: true,
  });
  adminToken = generateAccessToken({ userId: adminUser._id.toString(), role: ROLES.SUPER_ADMIN });

  const doctorUser = await UserModel.create({
    name: 'Dr. Jane',
    email: 'jane@hospital.com',
    password: await hashPassword('Doctor@123'),
    role: ROLES.DOCTOR,
    isActive: true,
    isActivated: true,
  });
  doctorToken = generateAccessToken({ userId: doctorUser._id.toString(), role: ROLES.DOCTOR });
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}, 30000);

beforeEach(async () => {
  await DepartmentModel.deleteMany({});
  await UserModel.deleteMany({ role: { $ne: ROLES.SUPER_ADMIN } });

  const dept = await DepartmentModel.create({
    name: 'Cardiology',
    code: 'CARD',
    description: 'Heart Department',
    isActive: true,
  });
  testDeptId = dept._id.toString();
});

describe('Staff Management & Invariant Rules', () => {
  describe('Doctor Department Assignments', () => {
    it('allows Super Admin to create a Doctor assigned to a department', async () => {
      const res = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Dr. Gregory House',
          email: 'house@hospital.com',
          role: ROLES.DOCTOR,
          department: testDeptId,
          specialization: 'Diagnostic Medicine',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.staff.role).toBe(ROLES.DOCTOR);
      expect(res.body.data.staff.department.id).toBe(testDeptId);
      expect(res.body.data).toHaveProperty('activationLink');
    });

    it('allows multiple doctors to belong to the same department', async () => {
      const res1 = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Dr. Allison Cameron',
          email: 'cameron@hospital.com',
          role: ROLES.DOCTOR,
          department: testDeptId,
        });

      const res2 = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Dr. Robert Chase',
          email: 'chase@hospital.com',
          role: ROLES.DOCTOR,
          department: testDeptId,
        });

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
    });
  });

  describe('Active Receptionist Invariant & Concurrency', () => {
    it('allows assigning one active receptionist to a department', async () => {
      const res = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Receptionist Sarah',
          email: 'sarah@hospital.com',
          role: ROLES.RECEPTIONIST,
          department: testDeptId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.staff.role).toBe(ROLES.RECEPTIONIST);
    });

    it('rejects a second active receptionist in the same department with 409 Conflict', async () => {
      // 1st receptionist
      await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Receptionist Sarah',
          email: 'sarah@hospital.com',
          role: ROLES.RECEPTIONIST,
          department: testDeptId,
        });

      // 2nd receptionist in same department
      const res = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Receptionist John',
          email: 'john@hospital.com',
          role: ROLES.RECEPTIONIST,
          department: testDeptId,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('active receptionist');
    });

    it('atomically rejects duplicate receptionist under concurrent creation requests', async () => {
      // Send 2 requests at the exact same instant
      const [resA, resB] = await Promise.all([
        request(app)
          .post('/api/v1/staff')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Concurrent Rec A',
            email: 'rec_a@hospital.com',
            role: ROLES.RECEPTIONIST,
            department: testDeptId,
          }),
        request(app)
          .post('/api/v1/staff')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Concurrent Rec B',
            email: 'rec_b@hospital.com',
            role: ROLES.RECEPTIONIST,
            department: testDeptId,
          }),
      ]);

      const statuses = [resA.status, resB.status];
      // Exactly one must succeed (201) and the other must be rejected (409)
      expect(statuses).toContain(201);
      expect(statuses).toContain(409);
    });

    it('allows a replacement receptionist after the first is deactivated', async () => {
      // 1st receptionist
      const rec1 = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Receptionist Sarah',
          email: 'sarah@hospital.com',
          role: ROLES.RECEPTIONIST,
          department: testDeptId,
        });

      const rec1Id = rec1.body.data.staff.id;

      // Deactivate 1st receptionist
      await request(app)
        .patch(`/api/v1/staff/${rec1Id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      // 2nd receptionist can now be assigned to testDeptId
      const rec2 = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Replacement Receptionist Emily',
          email: 'emily@hospital.com',
          role: ROLES.RECEPTIONIST,
          department: testDeptId,
        });

      expect(rec2.status).toBe(201);
      expect(rec2.body.data.staff.isActive).toBe(true);
    });
  });

  describe('Account Activation Flow', () => {
    it('allows invited staff member to activate account and subsequently log in', async () => {
      // 1. Super Admin invites doctor
      const createRes = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Dr. James Wilson',
          email: 'wilson@hospital.com',
          role: ROLES.DOCTOR,
          department: testDeptId,
        });

      expect(createRes.status).toBe(201);
      const activationLink = createRes.body.data.activationLink as string;
      const token = new URL(activationLink).searchParams.get('token');
      expect(token).toBeDefined();

      // 2. Doctor activates account
      const activateRes = await request(app)
        .post('/api/v1/auth/activate')
        .send({
          token,
          password: 'DoctorWilson@123',
        });

      expect(activateRes.status).toBe(200);
      expect(activateRes.body.success).toBe(true);

      // 3. Doctor logs in with new password
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'wilson@hospital.com',
          password: 'DoctorWilson@123',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.user.email).toBe('wilson@hospital.com');
      expect(loginRes.body.data.user.role).toBe(ROLES.DOCTOR);
    });

    it('rejects activation with invalid token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/activate')
        .send({
          token: 'invalid_token_12345678',
          password: 'ValidPassword@123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Super Admin Protection', () => {
    it('prevents deactivating or modifying the primary Super Admin account', async () => {
      const admin = await UserModel.findOne({ email: 'admin@hospital.com' });

      const res = await request(app)
        .patch(`/api/v1/staff/${admin!._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Super Admin');
    });

    it('rejects non-Super Admin (DOCTOR) from managing staff', async () => {
      const res = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          name: 'Unauthorized User',
          email: 'unauth@hospital.com',
          role: ROLES.DOCTOR,
          department: testDeptId,
        });

      expect(res.status).toBe(403);
    });
  });
});
