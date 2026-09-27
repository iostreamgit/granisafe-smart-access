export const EmployeeStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type EmployeeStatus = (typeof EmployeeStatus)[keyof typeof EmployeeStatus];

export const IdentifierType = {
  QR: 'QR',
  RFID: 'RFID',
} as const;

export type IdentifierType = (typeof IdentifierType)[keyof typeof IdentifierType];
