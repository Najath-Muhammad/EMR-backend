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

  // Resources
  NOT_FOUND: 'The requested resource was not found',
  ALREADY_EXISTS: 'Resource already exists',

  // Server
  SERVER_ERROR: 'An unexpected error occurred. Please try again later.',
} as const;
