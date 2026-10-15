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

  // Resources
  NOT_FOUND: 'The requested resource was not found',
  ALREADY_EXISTS: 'Resource already exists',

  // Server
  SERVER_ERROR: 'An unexpected error occurred. Please try again later.',
} as const;
