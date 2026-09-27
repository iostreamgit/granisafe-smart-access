export const RoleCode = {
  ADMIN: 'ADMIN',
  GUARD: 'GUARD',
  SUPERVISOR: 'SUPERVISOR',
  HR: 'HR',
  EMPLOYEE: 'EMPLOYEE',
} as const;

export type RoleCode = (typeof RoleCode)[keyof typeof RoleCode];
