# EMR Backend

Enterprise EMR Appointment Management System — Backend Service

## Tech Stack

- **Runtime**: Node.js v22+
- **Framework**: Express.js 4
- **Language**: TypeScript 5 (strict)
- **Database**: MongoDB via Mongoose 8
- **Validation**: Zod
- **Auth**: JWT + bcryptjs
- **Real-time**: Socket.IO
- **Testing**: Vitest + Supertest

## Prerequisites

- Node.js v22+
- npm 11+
- MongoDB (local, Docker, or Atlas)
- Git

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — fill in MONGODB_URI and JWT_SECRET

# 3. Start development server
npm run dev
```

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to dist/ |
| `npm start` | Run compiled dist/server.js |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint errors |
| `npm run typecheck` | TypeScript type checking (no emit) |
| `npm test` | Run all Vitest tests |
| `npm run test:watch` | Run Vitest in watch mode |

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Runtime environment |
| `PORT` | No | `5000` | HTTP port |
| `MONGODB_URI` | **Yes** | — | MongoDB connection string |
| `JWT_SECRET` | **Yes** | — | JWT signing secret (min 32 chars) |
| `JWT_EXPIRES_IN` | No | `7d` | JWT expiry duration |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Allowed CORS origins (comma-separated) |
| `LOG_LEVEL` | No | `info` | Log level: debug\|info\|warn\|error |

## Architecture

```
src/
  config/         → Database connection, typed env loader
  constants/      → HTTP status codes, messages, route paths
  controllers/    → HTTP request/response handling (interfaces + implementation)
  services/       → Business logic (interfaces + implementation)
  repositories/   → Persistence operations (interfaces + implementation)
  models/         → Mongoose schemas and models
  routes/         → Express route registration
  middlewares/    → Error handler, 404, request logging
  validators/     → Zod request schemas
  mappers/        → Entity ↔ DTO transformers
  dtos/           → API response types and builders
  errors/         → Application error classes
  utils/          → Logger and shared utilities
  app.ts          → Express app factory
  server.ts       → HTTP + Socket.IO bootstrap
```

## API Response Format

All endpoints return:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "meta": {}
}
```

Errors use `success: false` and `data: null`.

## Health Endpoint

```
GET /api/v1/health
```

Response:
```json
{
  "success": true,
  "message": "Service is healthy and running",
  "data": {
    "status": "ok",
    "uptime": 12,
    "timestamp": "2026-10-15T07:44:00.000Z",
    "version": "0.1.0",
    "environment": "development"
  },
  "meta": {}
}
```

## Git Workflow

- `main` → untouched production branch
- `dev` → integration branch
- `chore/*`, `feat/*`, `fix/*` → feature branches from `dev`

Never merge directly into `main` during development.

## Roles

| Role | Permissions |
|---|---|
| `SUPER_ADMIN` | Full system access; manages departments, users, schedules |
| `RECEPTIONIST` | Manages patients and appointments within their department |
| `DOCTOR` | Views own appointments and patient info only |

## Department Rule

Each department may have multiple doctors but only **one active receptionist**.
