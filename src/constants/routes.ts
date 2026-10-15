export const ROUTES = {
  BASE: '/api/v1',
  HEALTH: '/health',
  AUTH: '/auth',
  USERS: '/users',
  DEPARTMENTS: '/departments',
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
} as const;
