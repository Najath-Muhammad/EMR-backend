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
process.env['PORT'] = '5003';
process.env['MONGODB_URI'] = 'mongodb://localhost:27017/unused_for_dept_test';

let app: Application;
let mongoServer: MongoMemoryServer;
let adminToken: string;
let doctorToken: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

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
});

describe('Department Management', () => {
  describe('POST /api/v1/departments', () => {
    it('allows Super Admin to create a department', async () => {
      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Cardiology',
          code: 'CARD',
          description: 'Heart and cardiovascular care',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Cardiology');
      expect(res.body.data.code).toBe('CARD');
      expect(res.body.data.isActive).toBe(true);
    });

    it('rejects duplicate department name or code with 409', async () => {
      await DepartmentModel.create({
        name: 'Cardiology',
        code: 'CARD',
        description: 'First department',
      });

      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Cardiology',
          code: 'CARD2',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthorized roles (DOCTOR) with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          name: 'Neurology',
          code: 'NEUR',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/departments (Pagination & Search)', () => {
    beforeEach(async () => {
      await DepartmentModel.create([
        { name: 'Cardiology', code: 'CARD', description: 'Heart care', isActive: true },
        { name: 'Neurology', code: 'NEUR', description: 'Brain and nerve care', isActive: true },
        { name: 'Pediatrics', code: 'PEDI', description: 'Child care', isActive: false },
      ]);
    });

    it('returns paginated departments with metadata', async () => {
      const res = await request(app)
        .get('/api/v1/departments?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });

    it('filters departments by search query', async () => {
      const res = await request(app)
        .get('/api/v1/departments?search=brain')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].code).toBe('NEUR');
    });

    it('filters departments by active status', async () => {
      const res = await request(app)
        .get('/api/v1/departments?isActive=false')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].code).toBe('PEDI');
    });
  });

  describe('PUT /api/v1/departments/:id & PATCH /api/v1/departments/:id/status', () => {
    it('updates department details', async () => {
      const dept = await DepartmentModel.create({
        name: 'Orthopedics',
        code: 'ORTH',
        description: 'Bone care',
      });

      const res = await request(app)
        .put(`/api/v1/departments/${dept._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Orthopedics & Spine',
          description: 'Comprehensive bone and spine care',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Orthopedics & Spine');
    });

    it('deactivates and reactivates a department', async () => {
      const dept = await DepartmentModel.create({
        name: 'Dermatology',
        code: 'DERM',
        isActive: true,
      });

      const deactivateRes = await request(app)
        .patch(`/api/v1/departments/${dept._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(deactivateRes.status).toBe(200);
      expect(deactivateRes.body.data.isActive).toBe(false);

      const activateRes = await request(app)
        .patch(`/api/v1/departments/${dept._id.toString()}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: true });

      expect(activateRes.status).toBe(200);
      expect(activateRes.body.data.isActive).toBe(true);
    });
  });
});
