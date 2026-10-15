export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  RECEPTIONIST: 'RECEPTIONIST',
  DOCTOR: 'DOCTOR',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: Role[] = [
  ROLES.SUPER_ADMIN,
  ROLES.RECEPTIONIST,
  ROLES.DOCTOR,
];
