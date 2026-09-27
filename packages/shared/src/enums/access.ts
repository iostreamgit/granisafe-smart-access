export const AccessDirection = {
  ENTRY: 'ENTRY',
  EXIT: 'EXIT',
} as const;

export type AccessDirection = (typeof AccessDirection)[keyof typeof AccessDirection];

export const AccessAttemptStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  GRANTED: 'GRANTED',
  DENIED: 'DENIED',
  ERROR: 'ERROR',
} as const;

export type AccessAttemptStatus = (typeof AccessAttemptStatus)[keyof typeof AccessAttemptStatus];

export const AccessIdentifyMethod = {
  QR: 'QR',
  RFID: 'RFID',
  /** Demo convenience: resolve by employeeCode without scanning. */
  EMPLOYEE_CODE: 'EMPLOYEE_CODE',
} as const;

export type AccessIdentifyMethod = (typeof AccessIdentifyMethod)[keyof typeof AccessIdentifyMethod];

export const FakeAiScenario = {
  ALL_OK: 'ALL_OK',
  MISSING_HELMET: 'MISSING_HELMET',
  MISSING_VEST: 'MISSING_VEST',
  MISSING_UNIFORM: 'MISSING_UNIFORM',
  NONE: 'NONE',
  AI_ERROR: 'AI_ERROR',
} as const;

export type FakeAiScenario = (typeof FakeAiScenario)[keyof typeof FakeAiScenario];
