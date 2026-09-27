export const PunchType = {
  ENTRY: 'ENTRY',
  EXIT: 'EXIT',
} as const;

export type PunchType = (typeof PunchType)[keyof typeof PunchType];

export const AttendanceSource = {
  ACCESS_GRANT: 'ACCESS_GRANT',
  MANUAL: 'MANUAL',
} as const;

export type AttendanceSource = (typeof AttendanceSource)[keyof typeof AttendanceSource];
