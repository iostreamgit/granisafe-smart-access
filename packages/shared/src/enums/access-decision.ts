export const AccessDecision = {
  GRANTED: 'GRANTED',
  DENIED: 'DENIED',
} as const;

export type AccessDecision = (typeof AccessDecision)[keyof typeof AccessDecision];
