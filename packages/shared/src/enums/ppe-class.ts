export const PpeClass = {
  HELMET: 'HELMET',
  SAFETY_VEST: 'SAFETY_VEST',
  UNIFORM: 'UNIFORM',
} as const;

export type PpeClass = (typeof PpeClass)[keyof typeof PpeClass];
