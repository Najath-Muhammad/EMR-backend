import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

// Set required env vars before importing app modules
process.env['NODE_ENV'] = 'test';
process.env['MONGODB_URI'] = 'mongodb://localhost:27017/emr_test';
process.env['JWT_SECRET'] = 'test-secret-that-is-at-least-32-characters-long';
process.env['PORT'] = '5001';

let app: Application;

beforeAll(async () => {
  const { createApp } = await import('../src/app');
  app = createApp();
});

describe('Health Endpoint', () => {
  describe('GET /api/v1/health', () => {
    it('returns 200 with success envelope', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Service is healthy and running');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data).toHaveProperty('uptime');
      expect(res.body.data).toHaveProperty('timestamp');
      expect(res.body.data).toHaveProperty('version');
      expect(res.body.data).toHaveProperty('environment');
      expect(res.body.meta).toBeDefined();
    });

    it('has the correct response envelope shape', async () => {
      const res = await request(app).get('/api/v1/health');
      const body = res.body as Record<string, unknown>;

      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
    });
  });

  describe('404 handling', () => {
    it('returns 404 with error envelope for unknown routes', async () => {
      const res = await request(app).get('/api/v1/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.data).toBeNull();
    });

    it('returns 404 for routes outside the base path', async () => {
      const res = await request(app).get('/unknown');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
