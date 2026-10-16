import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Application } from 'express';
import { createApp } from '../src/app';
import { UserModel } from '../src/models/User.model';
import { AuditLogModel } from '../src/models/AuditLog.model';
import { ROLES } from '../src/constants/roles';
import { generateAccessToken } from '../src/utils/token.util';
import { hashPassword } from '../src/utils/password.util';

let app: Application;
let mongoServer: MongoMemoryServer;
let adminToken: string;
let receptionistToken: string;
let doctorToken: string;
let adminUserId: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  app = createApp();
}, 60000);

afterAll(async () => {
  await UserModel.deleteMany({ email: /test-audit/ });
  await AuditLogModel.deleteMany({});
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}, 30000);

beforeEach(async () => {
  await AuditLogModel.deleteMany({});
  await UserModel.deleteMany({ email: /test-audit/ });

  const passwordHash = await hashPassword('Test@12345');

  // 1. Create Super Admin
  const admin = await UserModel.create({
    name: 'Audit Admin',
    email: 'admin.test-audit@hospital.com',
    password: passwordHash,
    role: ROLES.SUPER_ADMIN,
    isActive: true,
  });
  adminUserId = admin._id.toString();
  adminToken = generateAccessToken({ userId: adminUserId, role: ROLES.SUPER_ADMIN });

  // 2. Create Receptionist
  const receptionist = await UserModel.create({
    name: 'Audit Receptionist',
    email: 'recep.test-audit@hospital.com',
    password: passwordHash,
    role: ROLES.RECEPTIONIST,
    isActive: true,
  });
  receptionistToken = generateAccessToken({
    userId: receptionist._id.toString(),
    role: ROLES.RECEPTIONIST,
  });

  // 3. Create Doctor
  const doctor = await UserModel.create({
    name: 'Audit Doctor',
    email: 'doctor.test-audit@hospital.com',
    password: passwordHash,
    role: ROLES.DOCTOR,
    isActive: true,
  });
  doctorToken = generateAccessToken({
    userId: doctor._id.toString(),
    role: ROLES.DOCTOR,
  });
});

describe('Audit Trail API & Security Tests', () => {
  describe('RBAC Authorization', () => {
    it('allows SUPER_ADMIN to query audit logs', async () => {
      await AuditLogModel.create({
        action: 'AUTH_LOGIN_SUCCESS',
        entityType: 'Auth',
        status: 'SUCCESS',
      });

      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(1);
      expect(res.body.meta).toHaveProperty('total', 1);
    });

    it('rejects RECEPTIONIST with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects DOCTOR with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/audit-logs');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Server-Side Filtering, Searching & Pagination', () => {
    beforeEach(async () => {
      await AuditLogModel.create([
        {
          action: 'AUTH_LOGIN_SUCCESS',
          entityType: 'Auth',
          status: 'SUCCESS',
          actor: { email: 'admin@hospital.com', name: 'Admin', role: 'SUPER_ADMIN' },
          createdAt: new Date('2026-10-01T10:00:00Z'),
        },
        {
          action: 'APPOINTMENT_CREATE',
          entityType: 'Appointment',
          entityId: 'APP-101',
          status: 'SUCCESS',
          actor: { email: 'recep@hospital.com', name: 'Sarah', role: 'RECEPTIONIST' },
          createdAt: new Date('2026-10-05T12:00:00Z'),
        },
        {
          action: 'APPOINTMENT_CANCEL',
          entityType: 'Appointment',
          entityId: 'APP-102',
          status: 'SUCCESS',
          actor: { email: 'recep@hospital.com', name: 'Sarah', role: 'RECEPTIONIST' },
          createdAt: new Date('2026-10-10T14:00:00Z'),
        },
        {
          action: 'STAFF_STATUS_TOGGLE',
          entityType: 'User',
          status: 'SUCCESS',
          actor: { email: 'admin@hospital.com', name: 'Admin', role: 'SUPER_ADMIN' },
          createdAt: new Date('2026-10-15T08:00:00Z'),
        },
      ]);
    });

    it('filters by action', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs?action=APPOINTMENT_CREATE')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].action).toBe('APPOINTMENT_CREATE');
      expect(res.body.data[0].entityId).toBe('APP-101');
    });

    it('filters by entityType', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs?entityType=Appointment')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it('searches by keyword across actor name and entity ID', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs?search=APP-102')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].action).toBe('APPOINTMENT_CANCEL');
    });

    it('paginates results accurately', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(4);
      expect(res.body.meta.totalPages).toBe(2);
    });

    it('sorts by createdAt ascending or descending', async () => {
      const resAsc = await request(app)
        .get('/api/v1/audit-logs?sortBy=createdAt&sortOrder=asc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resAsc.status).toBe(200);
      expect(resAsc.body.data[0].action).toBe('AUTH_LOGIN_SUCCESS');

      const resDesc = await request(app)
        .get('/api/v1/audit-logs?sortBy=createdAt&sortOrder=desc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resDesc.status).toBe(200);
      expect(resDesc.body.data[0].action).toBe('STAFF_STATUS_TOGGLE');
    });
  });

  describe('Detail Inspection & Immutability Protection', () => {
    it('retrieves single audit log by ID', async () => {
      const log = await AuditLogModel.create({
        action: 'SCHEDULE_UPDATE',
        entityType: 'Schedule',
        status: 'SUCCESS',
        actor: { email: 'admin@hospital.com' },
        details: { doctorId: 'doc-123', slotDuration: 30 },
      });

      const res = await request(app)
        .get(`/api/v1/audit-logs/${log._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.action).toBe('SCHEDULE_UPDATE');
      expect(res.body.data.details.slotDuration).toBe(30);
    });

    it('returns 404 for non-existent audit log ID', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/v1/audit-logs/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('redacts sensitive fields like passwords and tokens in responses', async () => {
      const log = await AuditLogModel.create({
        action: 'AUTH_LOGIN_FAILURE',
        entityType: 'Auth',
        status: 'FAILURE',
        details: {
          password: 'SecretPassword123',
          token: 'jwt-raw-token-abc',
          safeField: 'valid_data',
        },
      });

      const res = await request(app)
        .get(`/api/v1/audit-logs/${log._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.details.password).toBe('[REDACTED]');
      expect(res.body.data.details.token).toBe('[REDACTED]');
      expect(res.body.data.details.safeField).toBe('valid_data');
    });

    it('enforces immutability: rejects PUT, PATCH, and DELETE on audit logs with 404', async () => {
      const log = await AuditLogModel.create({
        action: 'APPOINTMENT_CREATE',
        entityType: 'Appointment',
        status: 'SUCCESS',
      });

      const resPut = await request(app)
        .put(`/api/v1/audit-logs/${log._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'MODIFIED' });
      expect(resPut.status).toBe(404);

      const resPatch = await request(app)
        .patch(`/api/v1/audit-logs/${log._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'MODIFIED' });
      expect(resPatch.status).toBe(404);

      const resDelete = await request(app)
        .delete(`/api/v1/audit-logs/${log._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resDelete.status).toBe(404);
    });
  });
});
