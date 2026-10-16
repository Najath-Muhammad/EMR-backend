# EMR Appointment Management System — API Specification

Base URL: `http://localhost:5000/api/v1`

All responses follow a consistent envelope structure. Successful responses return HTTP `200` or `201` with `success: true`. Errors return appropriate 4xx/5xx status codes with `success: false` and `data: null`.

---

## Standard Response Format

### Success Envelope
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

### Error Envelope
```json
{
  "success": false,
  "message": "Description of the error condition",
  "data": null,
  "meta": {}
}
```

---

## Authentication & Session Management

All authenticated endpoints require an `Authorization: Bearer <access_token>` header. Refresh tokens are transmitted automatically via secure, HTTP-only browser cookies.

---

### 1. Health Check
- **`GET /health`**
- **Access**: Public
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "Service is healthy and running",
    "data": {
      "status": "ok",
      "uptime": 1240,
      "timestamp": "2026-10-16T10:00:00.000Z",
      "version": "0.1.0",
      "environment": "development"
    },
    "meta": {}
  }
  ```

---

### 2. Staff Authentication

#### `POST /auth/login`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "admin@hospital.com",
    "password": "Admin@12345"
  }
  ```
- **Validation Rules**:
  - `email`: Valid email format, required.
  - `password`: String, minimum 6 characters.
- **Success (`200 OK`)**: Sets HttpOnly `refreshToken` cookie.
  ```json
  {
    "success": true,
    "message": "Authentication successful",
    "data": {
      "accessToken": "eyJhbGciOi...",
      "user": {
        "id": "6ad09104...",
        "name": "Hospital Super Admin",
        "email": "admin@hospital.com",
        "role": "SUPER_ADMIN",
        "department": null,
        "isActive": true
      }
    },
    "meta": {}
  }
  ```
- **Errors**: `401 Unauthorized` (Invalid credentials or inactive account), `422 Unprocessable Entity` (Formatting error).

#### `POST /auth/refresh`
- **Access**: Public (Requires valid `refreshToken` HttpOnly cookie)
- **Behavior**: Rotates both tokens. Detects reuse; revokes entire family if compromised.
- **Success (`200 OK`)**: Sets new `refreshToken` cookie; returns new `accessToken`.

#### `POST /auth/logout`
- **Access**: Authenticated
- **Behavior**: Revokes refresh token in database and clears the `refreshToken` cookie.
- **Success (`200 OK`)**

#### `GET /auth/me`
- **Access**: Authenticated (`SUPER_ADMIN`, `RECEPTIONIST`, `DOCTOR`)
- **Headers**: `Authorization: Bearer <accessToken>`
- **Success (`200 OK`)**: Returns current user profile with department details.

#### `POST /auth/activate`
- **Access**: Public (Invitation link activation)
- **Request Body**:
  ```json
  {
    "token": "raw-activation-token-from-invite",
    "password": "NewSecurePassword@123"
  }
  ```
- **Success (`200 OK`)**: Activates staff account and allows subsequent logins.

---

## Department Management

### `GET /departments`
- **Access**: Authenticated (`SUPER_ADMIN`, `RECEPTIONIST`, `DOCTOR`)
- **Query Parameters**:
  - `page` (number, default: 1)
  - `limit` (number, default: 10, max: 100)
  - `search` (string, optional: matches name or code)
  - `isActive` (boolean, optional: filter active/inactive)
  - `sortBy` (`name` | `code` | `createdAt`, default: `name`)
  - `sortOrder` (`asc` | `desc`, default: `asc`)
- **Success (`200 OK`)**: Paginated department list with live doctor counts and receptionist status.

### `POST /departments`
- **Access**: `SUPER_ADMIN`
- **Request Body**:
  ```json
  {
    "name": "Cardiology",
    "code": "CARD",
    "description": "Heart and cardiovascular care"
  }
  ```
- **Validation Rules**:
  - `name`: 2–100 characters. Unique.
  - `code`: 2–10 characters. Uppercase normalized. Unique.
- **Errors**: `409 Conflict` (Duplicate department name or code), `422 Unprocessable Entity`.

### `PUT /departments/:id`
- **Access**: `SUPER_ADMIN`
- **Request Body**: `{ "name": "Cardiology & Vascular", "description": "Updated..." }`
- **Errors**: `404 Not Found`, `409 Conflict`.

### `PATCH /departments/:id/status`
- **Access**: `SUPER_ADMIN`
- **Request Body**: `{ "isActive": false }`
- **Invariant Rule**: Rejects deactivation if department has active receptionist or assigned doctors.
- **Errors**: `400 Bad Request` ("Cannot deactivate department with active staff"), `404 Not Found`.

---

## Staff & Doctor Management

### `GET /staff`
- **Access**: `SUPER_ADMIN`
- **Query Parameters**: `role`, `department`, `isActive`, `search`, `page`, `limit`
- **Success (`200 OK`)**: Returns list of all hospital staff with populated department info.

### `POST /staff`
- **Access**: `SUPER_ADMIN`
- **Request Body**:
  ```json
  {
    "name": "Dr. Sarah Jenkins",
    "email": "sarah.jenkins@hospital.com",
    "role": "RECEPTIONIST",
    "department": "6ad09d007c97e18a1d27eba3",
    "phone": "555-123-4567"
  }
  ```
- **Invariant Rules**:
  - If `role === 'RECEPTIONIST'`, verifies department does not already have an active receptionist (`409 Conflict`).
- **Success (`201 Created`)**: Creates account in unactivated state, generates activation token, logs audit event.

### `PATCH /staff/:id/status`
- **Access**: `SUPER_ADMIN`
- **Request Body**: `{ "isActive": false }`
- **Invariant Rules**:
  - Deactivating a receptionist frees the department slot.
  - Reactivating a receptionist fails if another active receptionist was assigned in the interim (`409 Conflict`).

### `POST /staff/:id/resend-activation`
- **Access**: `SUPER_ADMIN`
- **Success (`200 OK`)**: Generates fresh activation link and logs audit event.

---

## Doctor Schedules & Slot Generation

### `GET /doctors/:id/schedule`
- **Access**: `SUPER_ADMIN`, or `DOCTOR` (requesting own schedule only)
- **Success (`200 OK`)**: Returns 7-day schedule configuration, OPD sessions, breaks, and slot duration (15m, 30m, 45m, 60m).

### `PUT /doctors/:id/schedule`
- **Access**: `SUPER_ADMIN`
- **Request Body**:
  ```json
  {
    "slotDurationMinutes": 15,
    "workingDays": [
      {
        "dayOfWeek": 1,
        "dayName": "MONDAY",
        "isEnabled": true,
        "sessions": [{ "startTime": "09:00", "endTime": "13:00", "label": "Morning OPD" }],
        "breaks": [{ "startTime": "11:00", "endTime": "11:30", "label": "Tea Break" }]
      }
    ]
  }
  ```
- **Validation Rules**:
  - Session and break times must be valid `HH:mm` format.
  - Breaks must fall strictly within session windows without overlapping each other.
- **Concurrency & Conflict Handling**: If modifying schedule conflicts with existing booked appointments, returns `409 Conflict` with list of affected bookings unless `forceOverride: true` is passed.

### `GET /slots/preview`
- **Access**: Authenticated (`SUPER_ADMIN`, `RECEPTIONIST`, `DOCTOR`)
- **Query Parameters**:
  - `doctorId`: MongoDB ObjectId of doctor (Required)
  - `date`: `YYYY-MM-DD` (Required)
- **Success (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Available slots computed",
    "data": {
      "doctorId": "6ad09d...",
      "date": "2026-10-20",
      "slotDurationMinutes": 15,
      "totalSlots": 16,
      "availableSlotsCount": 14,
      "bookedSlotsCount": 2,
      "slots": [
        { "startTime": "09:00", "endTime": "09:15", "status": "AVAILABLE" },
        { "startTime": "09:15", "endTime": "09:30", "status": "BOOKED" }
      ]
    },
    "meta": {}
  }
  ```

---

## Patient Management & Duplicate Pre-screening

### `GET /patients`
- **Access**: `SUPER_ADMIN`, `RECEPTIONIST`, `DOCTOR`
- **Query Parameters**: `search`, `page`, `limit`, `gender`, `sortBy`, `sortOrder`
- **Success (`200 OK`)**: Returns paginated universal patient directory.

### `POST /patients/check-duplicates`
- **Access**: `SUPER_ADMIN`, `RECEPTIONIST`
- **Request Body**:
  ```json
  {
    "fullName": "Johnathan Doe",
    "phone": "(555) 123-4567",
    "dateOfBirth": "1985-03-20"
  }
  ```
- **Success (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Potential duplicate records found",
    "data": {
      "hasMatches": true,
      "duplicates": [
        {
          "patient": { "id": "...", "patientId": "PAT-2026-00001", "fullName": "Johnathan Doe", ... },
          "matchReasons": [
            "Matches mobile phone number ((555) 123-4567)",
            "Exact match on full name and date of birth (1985-03-20)"
          ],
          "confidence": "HIGH"
        }
      ]
    },
    "meta": {}
  }
  ```

### `POST /patients`
- **Access**: `SUPER_ADMIN`, `RECEPTIONIST`
- **Request Body**:
  ```json
  {
    "fullName": "Johnathan Doe",
    "phone": "555-123-4567",
    "dateOfBirth": "1985-03-20",
    "gender": "MALE",
    "bloodGroup": "O+",
    "email": "john.doe@example.com",
    "address": "123 Main St",
    "registrationDepartment": "6ad09d00..."
  }
  ```
- **Auto-Sequence Generation**: Automatically assigns sequential ID `PAT-YYYY-XXXXX` with retry loop on collision.
- **Success (`201 Created`)**

---

## Appointment Booking & Concurrency Protection

### `POST /appointments`
- **Access**: `SUPER_ADMIN`, or `RECEPTIONIST` (scoped to assigned department)
- **Request Body**:
  ```json
  {
    "doctorId": "6ad09d...",
    "patientId": "6ad0a1...",
    "departmentId": "6ad08f...",
    "date": "2026-10-20",
    "startTime": "09:00",
    "endTime": "09:15",
    "purpose": "Routine cardiovascular consultation",
    "notes": "Patient reports mild chest tightness"
  }
  ```
- **Concurrency & Race Condition Handling**:
  - Enforced by MongoDB atomic partial unique index `{ doctor, date, startTime }`.
  - Simultaneous conflicting booking attempts return **`409 Conflict`**: `"The requested slot 09:00 is no longer available. Please select another slot."`
- **Real-Time Emission**: Emits `appointment:created` to `dept_{id}`, `doctor_{id}`, and `admin_audit` rooms upon successful persistence.
- **Success (`201 Created`)**

### `GET /appointments`
- **Access**:
  - `SUPER_ADMIN`: All appointments across the hospital.
  - `RECEPTIONIST`: Appointments within their assigned department.
  - `DOCTOR`: Only appointments where `doctor === req.user.userId`.
- **Query Parameters**: `doctorId`, `departmentId`, `date`, `status`, `search`, `page`, `limit`
- **Success (`200 OK`)**

### `PATCH /appointments/:id/arrive`
- **Access**: `SUPER_ADMIN`, `RECEPTIONIST` (department scoped)
- **State Transition**: `SCHEDULED` | `CONFIRMED` → `ARRIVED`
- **Real-Time Event**: Emits `appointment:updated` with `status: "ARRIVED"`.
- **Success (`200 OK`)**

### `PATCH /appointments/:id/complete`
- **Access**: Assigned `DOCTOR` only (or `SUPER_ADMIN`)
- **Request Body**:
  ```json
  {
    "consultationNotes": "ECG within normal limits. Prescribed medication; review in 3 months."
  }
  ```
- **State Transition**: `ARRIVED` | `CONFIRMED` → `COMPLETED`
- **Privacy Enforcement**: Other doctors attempting to complete this appointment receive `403 Forbidden`.
- **Success (`200 OK`)**

### `PATCH /appointments/:id/cancel`
- **Access**: `SUPER_ADMIN`, `RECEPTIONIST` (department scoped)
- **Request Body**: `{ "cancellationReason": "Patient requested reschedule" }`
- **State Transition**: → `CANCELLED` (Slot immediately freed for rebooking).
- **Success (`200 OK`)**

---

## Audit Trail API

### `GET /audit-logs`
- **Access**: `SUPER_ADMIN` only (`403 Forbidden` for doctors and receptionists)
- **Query Parameters**:
  - `action`: Filter by action (`AUTH_LOGIN_SUCCESS`, `APPOINTMENT_CREATE`, etc.)
  - `entityType`: Filter by entity (`APPOINTMENT`, `USER`, `DEPARTMENT`, `SCHEDULE`)
  - `search`: Keyword search across actor name and entity ID
  - `page`, `limit`, `sortBy`, `sortOrder`
- **Immutability Guarantee**: `PUT`, `PATCH`, and `DELETE` requests are rejected with `404 Not Found`. Audit records cannot be altered or removed through the application API.
- **Success (`200 OK`)**: Paginated audit list with sanitized metadata.

### `GET /audit-logs/:id`
- **Access**: `SUPER_ADMIN` only
- **Success (`200 OK`)**: Complete audit entry details with actor name, role, timestamp, IP, and safe metadata.
