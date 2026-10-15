export const ROUTES = {
  BASE: '/api/v1',
  HEALTH: '/health',
  AUTH: '/auth',
  USERS: '/users',
  DEPARTMENTS: '/departments',
  STAFF: '/staff',
  DOCTORS: '/doctors',
  PATIENTS: '/patients',
  APPOINTMENTS: '/appointments',
  SCHEDULES: '/schedules',
} as const;

export const AUTH_ROUTES = {
  LOGIN: '/login',
  REFRESH: '/refresh',
  LOGOUT: '/logout',
  ME: '/me',
  ACTIVATE: '/activate',
} as const;

export const DEPARTMENT_ROUTES = {
  ROOT: '/',
  BY_ID: '/:id',
  STATUS: '/:id/status',
} as const;

export const STAFF_ROUTES = {
  ROOT: '/',
  BY_ID: '/:id',
  STATUS: '/:id/status',
  RESEND_ACTIVATION: '/:id/resend-activation',
} as const;
