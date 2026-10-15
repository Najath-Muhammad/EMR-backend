export const MESSAGES = {
  // Health
  HEALTH_OK: 'Service is healthy and running',

  // General
  VALIDATION_FAILED: 'Validation failed',
  OPERATION_SUCCESS: 'Operation completed successfully',

  // Auth
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'You do not have permission to perform this action',
  INVALID_CREDENTIALS: 'Invalid email or password',
  TOKEN_EXPIRED: 'Session has expired. Please log in again',
  TOKEN_INVALID: 'Invalid authentication token',
  REFRESH_TOKEN_REQUIRED: 'Refresh token required',
  REFRESH_TOKEN_INVALID: 'Invalid or expired session. Please log in again',
  REFRESH_TOKEN_REUSE: 'Session terminated due to security violation. Please log in again',
  LOGOUT_SUCCESS: 'Logged out successfully',
  LOGIN_SUCCESS: 'Logged in successfully',
  TOKEN_REFRESHED: 'Token refreshed successfully',
  ME_SUCCESS: 'Current user retrieved successfully',
  USER_INACTIVE: 'Account is deactivated. Please contact an administrator',

  // Department
  DEPARTMENT_CREATED: 'Department created successfully',
  DEPARTMENT_UPDATED: 'Department updated successfully',
  DEPARTMENT_STATUS_UPDATED: 'Department status updated successfully',
  DEPARTMENT_NOT_FOUND: 'Department not found',
  DEPARTMENT_EXISTS: 'A department with this name or code already exists',
  DEPARTMENT_INVALID: 'Selected department is invalid or does not exist',
  DEPARTMENT_INACTIVE_ASSIGNMENT: 'Cannot assign staff to an inactive department',

  // Staff
  STAFF_CREATED: 'Staff account created successfully and invitation link generated',
  STAFF_UPDATED: 'Staff member updated successfully',
  STAFF_STATUS_UPDATED: 'Staff status updated successfully',
  STAFF_NOT_FOUND: 'Staff member not found',
  STAFF_EMAIL_EXISTS: 'A user with this email address already exists',
  RECEPTIONIST_LIMIT_EXCEEDED:
    'This department already has an active receptionist. Only one active receptionist is permitted per department.',
  SUPER_ADMIN_PROTECTED:
    'The primary Super Admin account is protected and cannot be modified, deactivated, or deleted.',
  ACCOUNT_ACTIVATED: 'Account activated successfully. You can now log in with your credentials.',
  ACTIVATION_TOKEN_INVALID: 'Invalid or expired invitation token. Please request a new invitation.',
  ACTIVATION_LINK_RESENT: 'Activation link has been regenerated successfully',

  // Schedule & Slots
  SCHEDULE_SAVED: 'Doctor schedule saved successfully',
  SCHEDULE_FETCHED: 'Doctor schedule fetched successfully',
  SCHEDULE_NOT_FOUND: 'Doctor schedule not found',
  SCHEDULE_STATUS_UPDATED: 'Doctor schedule status updated successfully',
  SCHEDULE_DOCTOR_NOT_FOUND: 'Doctor not found or user is not a physician',
  SCHEDULE_DOCTOR_INACTIVE: 'Cannot configure schedule for an inactive doctor',
  SCHEDULE_CONFLICT_DETECTED:
    'Schedule modification conflicts with existing booked appointments. Please resolve conflicts before updating.',
  SLOTS_FETCHED: 'Appointment slots fetched successfully',
  SLOTS_PREVIEW_GENERATED: 'Slot preview generated successfully',
  DOCTOR_NOT_SCHEDULED: 'Doctor has no active schedule for the selected day',

  // Patient
  PATIENT_CREATED: 'Patient registered successfully',
  PATIENT_FETCHED: 'Patient details retrieved successfully',
  PATIENTS_FETCHED: 'Patients list retrieved successfully',
  PATIENT_UPDATED: 'Patient details updated successfully',
  PATIENT_DUPLICATE_FOUND: 'Potential duplicate patient records found',
  PATIENT_NOT_FOUND: 'Patient record not found',
  PATIENT_ID_EXISTS: 'A patient with this identifier already exists',

  // Resources
  NOT_FOUND: 'The requested resource was not found',
  ALREADY_EXISTS: 'Resource already exists',

  // Appointments
  APPOINTMENT_CREATED: 'Appointment booked successfully',
  APPOINTMENT_FETCHED: 'Appointment details retrieved successfully',
  APPOINTMENTS_FETCHED: 'Appointments retrieved successfully',
  APPOINTMENT_CANCELLED: 'Appointment cancelled successfully',
  APPOINTMENT_NOT_FOUND: 'Appointment not found',
  APPOINTMENT_SLOT_ALREADY_BOOKED: 'This time slot has just been booked by another user. Please select another slot.',
  APPOINTMENT_DOCTOR_MISMATCH_DEPT: 'The selected doctor does not belong to the selected department',
  APPOINTMENT_PAST_DATE: 'Cannot book appointments for past dates or past time slots',
  APPOINTMENT_NO_SCHEDULE: 'Doctor does not have an active schedule for appointments',
  APPOINTMENT_DAY_OFF: 'Doctor is not scheduled to work on this day',
  APPOINTMENT_OUTSIDE_SESSION: 'Selected time slot does not fit within any of the doctor\'s working sessions',
  APPOINTMENT_BREAK_CONFLICT: 'Selected time slot falls within a scheduled break period',
  APPOINTMENT_INVALID_DURATION: 'Appointment duration does not match the doctor\'s configured schedule slot duration',
  APPOINTMENT_ALREADY_CANCELLED: 'This appointment has already been cancelled',
  APPOINTMENT_ALREADY_COMPLETED: 'Cannot cancel an appointment that has already been completed',
  APPOINTMENT_CANCEL_FORBIDDEN: 'You do not have permission to cancel this appointment',
  APPOINTMENT_ARRIVED: 'Patient marked as arrived successfully',
  APPOINTMENT_COMPLETED: 'Appointment completed successfully',
  APPOINTMENT_UPDATED: 'Appointment details updated successfully',
  APPOINTMENT_RESCHEDULED: 'Appointment rescheduled successfully',
  APPOINTMENT_CONSULTATION_SAVED: 'Consultation notes saved successfully',
  APPOINTMENT_CANNOT_TRANSITION: 'Invalid appointment status transition',
  APPOINTMENT_CANNOT_REOPEN: 'Completed or cancelled appointments cannot be modified',
  APPOINTMENT_DOCTOR_ONLY_CONSULTATION: 'Only the attending physician can edit consultation notes',
  RECEPTIONIST_DEPT_RESTRICTED: 'Receptionists can only schedule appointments within their assigned department',

  // Audit Logs
  AUDIT_LOGS_FETCHED: 'Audit logs retrieved successfully',
  AUDIT_LOG_FETCHED: 'Audit log details retrieved successfully',
  AUDIT_LOG_NOT_FOUND: 'Audit log record not found',

  // Server
  SERVER_ERROR: 'An unexpected error occurred. Please try again later.',
} as const;
