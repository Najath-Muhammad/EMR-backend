# EMR Backend Service

Enterprise Electronic Medical Record (EMR) Appointment Management System — robust, production-grade backend built with Node.js, Express, TypeScript, and MongoDB.

---

## 1. Project Overview

The EMR Backend Service provides a secure, high-concurrency clinical scheduling and patient management API. It coordinates patient registrations, multi-session doctor availability templates, double-booking prevention, appointment state lifecycle transitions, real-time Socket.IO broadcasts, and an immutable audit log.

### Key Capabilities
- **Strict Role-Based Access Control (RBAC)** for `SUPER_ADMIN`, `DOCTOR`, and `RECEPTIONIST`.
- **Atomic Double-Booking Prevention**: Database-level partial unique index eliminates appointment collisions even under concurrent requests.
- **Single Receptionist Invariant**: Guarantees at most one active receptionist per clinical department.
- **Real-Time Websocket Synchronization**: Socket.IO room-scoped broadcasts for slot updates, appointment lifecycle status transitions, and audit logs.
- **Race-Free Sequential Patient IDs**: Atomic MongoDB `$inc` sequences yielding standardized IDs (`PAT-YYYY-XXXX`).
- **Cryptographic Security**: Salted Bcrypt (cost 12), short-lived access JWTs, HttpOnly refresh token rotation with reuse family invalidation, and rate limiting.

---

## 2. Features & Role Permissions Matrix

| Feature / Resource | `SUPER_ADMIN` | `RECEPTIONIST` | `DOCTOR` |
|---|:---:|:---:|:---:|
| **Authentication & Profile** | Full | Full | Full |
| **Department Management** (CRUD, Activate/Deactivate) | Full | Read Only | Read Only |
| **User Staff Management** (Doctors & Receptionists) | Full | Denied | Denied |
| **Doctor Schedule Configuration** (Sessions & Breaks) | Full | Read Only | Read Only |
| **Doctor Slot Generation** (`/schedules/:doctorId/slots`) | Full | Full | Full |
| **Patient Registration & Duplicate Check** | Full | Full | Denied |
| **Patient Search & Directory** | Full | Full | Read (Assigned only) |
| **Book / Reschedule Appointments** | Full | Full | Denied |
| **Check-in Patient (`ARRIVED`)** | Full | Full | Denied |
| **Cancel Appointment** | Full | Full | Denied |
| **Consultation Notes & Completion (`COMPLETED`)** | Denied | Denied | Full (Own only) |
| **View Audit Trail** | Full | Denied | Denied |

---

## 3. Technology Stack

- **Runtime**: Node.js v22 (LTS)
- **Language**: TypeScript 5.5+ (strict mode enabled)
- **Framework**: Express.js 4.19
- **Database**: MongoDB via Mongoose 8.4 ODM
- **Schema Validation**: Zod 3.23
- **Security & Cryptography**: Bcryptjs 2.4, JSON Web Token (JWT) 9.0, Helmet 7.1, CORS 2.8
- **Real-Time Communication**: Socket.IO 4.7
- **Logging**: Structured Winston-style isomorphic logger with ISO timestamps and log levels
- **Automated Testing**: Vitest 2.0 + Supertest 7.0 + MongoMemoryServer (100% in-memory test isolation)

---

## 4. Repository Structure

```
emr-backend/
├── src/
│   ├── app.ts                  # Express application factory & middleware pipeline
│   ├── server.ts               # HTTP & Socket.IO server bootstrap & graceful shutdown
│   ├── config/                 # Typed Zod environment parsing & DB connection
│   ├── constants/              # HTTP codes, route paths, role enums, audit actions
│   ├── controllers/            # Controller interfaces and implementations
│   ├── dtos/                   # Unified ApiResponse<T> envelope & data contracts
│   ├── errors/                 # Domain error hierarchy (AppError, ConflictError, etc.)
│   ├── mappers/                # Entity-to-DTO sanitization mappers
│   ├── middlewares/            # Auth, RBAC guards, rate limiter, error & 404 handlers
│   ├── models/                 # Mongoose schemas, partial/unique indexes, and models
│   ├── repositories/           # Repository pattern (data access layer with try-catch)
│   ├── routes/                 # Express route definitions
│   ├── scripts/                # Database seeders (seedHospital.ts)
│   ├── services/               # Core business logic layer (pure domain rules)
│   ├── utils/                  # Structured logger, JWT helpers, phone normalizer
│   └── validators/             # Zod validation schemas for all incoming HTTP payloads
├── tests/                      # Vitest integration and unit test suite
├── API_DOCUMENTATION.md        # Exhaustive API specification (endpoints, params, responses)
├── DATABASE_SCHEMA.md          # Comprehensive ERD, collection schemas, indexes, and samples
├── ENGINEERING_DECISIONS.md    # Architecture rationale, double-booking proofs, scalability
├── package.json
└── tsconfig.json
```

---

## 5. Architecture Overview

The backend strictly implements **Clean Architecture** with unidirectional dependency flow:

```
[ HTTP Request / Socket.IO ]
            │
            ▼
    [ Middlewares ] ──── (Rate Limit, Auth Guard, RBAC, Validation)
            │
            ▼
   [ Controllers ]  ──── (DTO Parsing, HTTP Statuses, Response Envelope)
            │
            ▼
     [ Services ]   ──── (Pure Domain Rules, Slot Calculations, Invariant Checks)
            │
            ▼
   [ Repositories ] ──── (Data Access, Mongoose Queries, Safe Error Wrapping)
            │
            ▼
    [ MongoDB / MemoryServer ]
```

### Architectural Principles:
1. **Interface-Based Dependency Injection**: Every controller and service declares an interface (`IAppointmentService`, `IAppointmentRepository`). Implementations are injected via constructors.
2. **Standardized Response Envelope**:
   ```json
   {
     "success": true,
     "message": "Operation completed successfully",
     "data": { ... },
     "meta": { "page": 1, "limit": 10, "total": 45, "totalPages": 5 }
   }
   ```
3. **Data Sanitization Mappers**: Raw database documents never leak to clients. Passwords, token hashes, and internal version keys are stripped.

---

## 6. Database Design & Documentation

Full architectural documentation for data models, entity relationships, and indexing strategies is available in:
- 📖 **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)**: Full Mermaid ERD, detailed field definitions, index matrices, and sample JSON documents for all 8 collections (`users`, `departments`, `schedules`, `patients`, `appointments`, `refresh_tokens`, `counters`, `audit_logs`).
- 📖 **[ENGINEERING_DECISIONS.md](./ENGINEERING_DECISIONS.md)**: Technical rationale behind partial indexes, atomic double-booking prevention, token rotation, and sharding.
- 📖 **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**: Exhaustive endpoint documentation with authorization levels, validation rules, request bodies, and error responses.

---

## 7. Environment Variables

Create a `.env` file in the root of `emr-backend/` based on `.env.example`:

| Variable | Required | Default | Description |
|---|:---:|:---:|---|
| `NODE_ENV` | No | `development` | Environment mode (`development`, `test`, `production`). |
| `PORT` | No | `5000` | HTTP and WebSocket port. |
| `MONGODB_URI` | **Yes** | — | MongoDB connection string (e.g., `mongodb://localhost:27017/emr_db` or MongoDB Atlas). |
| `JWT_SECRET` | **Yes** | — | Symmetric secret for signing access tokens (min 32 characters). |
| `JWT_EXPIRES_IN` | No | `15m` | Lifetime of short-lived access tokens. |
| `JWT_REFRESH_SECRET` | **Yes** | — | Symmetric secret for signing refresh tokens (min 32 characters). |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Lifetime of refresh tokens. |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Comma-separated whitelist of allowed client origins. |
| `LOG_LEVEL` | No | `info` | Minimum log severity (`debug`, `info`, `warn`, `error`). |

---

## 8. Installation & Execution

### Prerequisites
- Node.js v22+
- npm v10+
- MongoDB instance (Local or Atlas)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env and supply valid MONGODB_URI, JWT_SECRET, and JWT_REFRESH_SECRET
```

### 3. Seed Database
Seeds a complete hospital environment with Super Admin, Cardiology, Pediatrics, General Medicine, Doctors with working schedules, Receptionists, and sample Patients:
```bash
npm run seed:hospital
```

### 4. Run Development Server
```bash
npm run dev
```
The server will start on `http://localhost:5000` with WebSocket support enabled.

### 5. Build for Production
```bash
npm run build
npm start
```

---

## 9. Automated Testing & Verification

The test suite runs Vitest against an isolated in-memory MongoDB server (`MongoMemoryServer`). It does not alter your development database or require external network access.

```bash
# Run all automated tests (140+ unit & integration tests)
npm test

# Run TypeScript typecheck
npm run typecheck

# Run ESLint validation
npm run lint
```

---

## 10. Seeded Credentials (Evaluation)

| Role | Email | Password | Department |
|---|---|---|---|
| **Super Admin** | `admin@hospital.com` | `Admin@123456` | Hospital-wide |
| **Receptionist** | `receptionist.card@hospital.com` | `Recept@123456` | Cardiology |
| **Receptionist** | `receptionist.peds@hospital.com` | `Recept@123456` | Pediatrics |
| **Doctor** | `dr.smith@hospital.com` | `Doctor@123456` | Cardiology |
| **Doctor** | `dr.patel@hospital.com` | `Doctor@123456` | Pediatrics |

---

## 11. Assumptions & Known Limitations

1. **Timezone Uniformity**: Slot times are formatted as `HH:mm` (24-hour) based on hospital local time. Cross-timezone clinic scheduling defaults to clinic server time.
2. **Slot Generation Horizon**: Slots are dynamically computed on-demand up to 30 days ahead based on the doctor's weekly recurring template.
3. **Doctor Availability**: Doctor absences/vacations are modeled by marking specific dates as non-working or cancelling specific slots. Future phases will support temporary date overrides.

---

## 12. Future Improvements

1. **Redis Caching Layer**: Add Redis caching for doctor schedules and frequently viewed department catalogs with pub/sub cache invalidation.
2. **Automated SMS/Email Reminders**: Integrate Twilio and SendGrid for automated 24-hour appointment reminders.
3. **FHIR / HL7 Interoperability**: Add FHIR R4 standard JSON export endpoints for patient records and clinical notes.
4. **Multi-Tenancy**: Extend the schema with `tenantId` to support multi-hospital health system deployments.
