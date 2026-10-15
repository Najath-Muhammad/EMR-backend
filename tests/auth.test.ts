import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Application } from 'express';
import { ROLES, Role } from '../src/constants/roles';
import { UserModel } from '../src/models/User.model';
import { RefreshTokenModel } from '../src/models/RefreshToken.model';
import { hashPassword } from '../src/utils/password.util';
import { COOKIE_NAMES } from '../src/constants/cookies';

// Ensure required environment variables for test environment
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-access-secret-key-min-32-characters-12345';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-key-min-32-characters-67890';
process.env['PORT'] = '5002';
process.env['MONGODB_URI'] = 'mongodb://localhost:27017/unused_for_test';

let app: Application;
let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const { createApp } = await import('../src/app');
  app = createApp();
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}, 30000);

beforeEach(async () => {
  await UserModel.deleteMany({});
  await RefreshTokenModel.deleteMany({});
});

async function createTestUser(role: Role = ROLES.DOCTOR, isActive = true) {
  const hashedPassword = await hashPassword('Password@123');
  return UserModel.create({
    name: `Test ${role}`,
    email: `${role.toLowerCase()}@hospital.com`,
    password: hashedPassword,
    role,
    isActive,
  });
}

describe('Authentication & RBAC Integration Tests', () => {
  describe('POST /api/v1/auth/login', () => {
    it('successfully logs in with valid credentials and sets HttpOnly cookie', async () => {
      await createTestUser(ROLES.SUPER_ADMIN);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'super_admin@hospital.com', password: 'Password@123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('super_admin@hospital.com');
      expect(res.body.data.user.role).toBe(ROLES.SUPER_ADMIN);
      expect(res.body.data.user).not.toHaveProperty('password');

      // Verify HttpOnly cookie header
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join(';') : String(cookies);
      expect(cookieStr).toContain(COOKIE_NAMES.REFRESH_TOKEN);
      expect(cookieStr).toContain('HttpOnly');
    });

    it('allows all three roles (SUPER_ADMIN, RECEPTIONIST, DOCTOR) to log in', async () => {
      for (const role of [ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR]) {
        await createTestUser(role);

        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: `${role.toLowerCase()}@hospital.com`, password: 'Password@123' });

        expect(res.status).toBe(200);
        expect(res.body.data.user.role).toBe(role);
      }
    });

    it('rejects invalid password with 401', async () => {
      await createTestUser(ROLES.DOCTOR);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'doctor@hospital.com', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.data).toBeNull();
    });

    it('rejects non-existent email with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'unknown@hospital.com', password: 'Password@123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects inactive user with 401', async () => {
      await createTestUser(ROLES.DOCTOR, false);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'doctor@hospital.com', password: 'Password@123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 422 for malformed input', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: '' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns current user profile with valid Bearer token', async () => {
      await createTestUser(ROLES.DOCTOR);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'doctor@hospital.com', password: 'Password@123' });

      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('doctor@hospital.com');
      expect(res.body.data.user.role).toBe(ROLES.DOCTOR);
      expect(res.body.data.user).not.toHaveProperty('password');
    });

    it('returns 401 when no token is supplied', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 when an invalid token is supplied', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.tampered.token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/refresh (Rotation & Reuse Detection)', () => {
    it('rotates refresh token and issues new access token', async () => {
      await createTestUser(ROLES.RECEPTIONIST);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'receptionist@hospital.com', password: 'Password@123' });

      const cookie = loginRes.headers['set-cookie'];

      // Perform refresh
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data).toHaveProperty('accessToken');
      expect(refreshRes.body.data.accessToken).not.toBe(loginRes.body.data.accessToken);

      // Verify a new cookie was returned
      const newCookie = refreshRes.headers['set-cookie'];
      expect(newCookie).toBeDefined();
    });

    it('returns 401 when refresh cookie is missing', async () => {
      const res = await request(app).post('/api/v1/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('detects token reuse and revokes entire family', async () => {
      await createTestUser(ROLES.DOCTOR);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'doctor@hospital.com', password: 'Password@123' });

      const originalCookie = loginRes.headers['set-cookie'];

      // First valid refresh: rotates token and revokes original
      const firstRefreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', originalCookie);
      expect(firstRefreshRes.status).toBe(200);

      // Malicious attempt: reuse the OLD revoked cookie!
      const reuseAttempt = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', originalCookie);

      expect(reuseAttempt.status).toBe(401);
      expect(reuseAttempt.body.success).toBe(false);

      // Now, even the newly rotated cookie should be revoked because family was invalidated!
      const rotatedCookie = firstRefreshRes.headers['set-cookie'];
      const followUpRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', rotatedCookie);

      expect(followUpRes.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('revokes refresh token and clears cookie on logout', async () => {
      await createTestUser(ROLES.DOCTOR);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'doctor@hospital.com', password: 'Password@123' });

      const cookie = loginRes.headers['set-cookie'];

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', cookie);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Verify refresh with that cookie now fails
      const refreshAfterLogout = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie);

      expect(refreshAfterLogout.status).toBe(401);
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('allows SUPER_ADMIN to access admin-only route', async () => {
      await createTestUser(ROLES.SUPER_ADMIN);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'super_admin@hospital.com', password: 'Password@123' });

      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/v1/auth/admin-only')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.secret).toBe('admin_data');
    });

    it('rejects DOCTOR from admin-only route with 403 Forbidden', async () => {
      await createTestUser(ROLES.DOCTOR);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'doctor@hospital.com', password: 'Password@123' });

      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/v1/auth/admin-only')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects RECEPTIONIST from admin-only route with 403 Forbidden', async () => {
      await createTestUser(ROLES.RECEPTIONIST);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'receptionist@hospital.com', password: 'Password@123' });

      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/v1/auth/admin-only')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
