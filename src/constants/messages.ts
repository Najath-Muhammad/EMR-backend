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

  // Resources
  NOT_FOUND: 'The requested resource was not found',
  ALREADY_EXISTS: 'Resource already exists',

  // Server
  SERVER_ERROR: 'An unexpected error occurred. Please try again later.',
} as const;
