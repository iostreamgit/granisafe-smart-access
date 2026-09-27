export const SETTING_KEYS = {
  gateOpenMs: 'gateOpenMs',
  accessCooldownSeconds: 'accessCooldownSeconds',
  defaultLateGraceMinutes: 'defaultLateGraceMinutes',
  evidenceRetentionDays: 'evidenceRetentionDays',
  failClosed: 'failClosed',
  helmetMinConfidence: 'ppe.HELMET.minConfidence',
  vestMinConfidence: 'ppe.SAFETY_VEST.minConfidence',
  uniformMinConfidence: 'ppe.UNIFORM.minConfidence',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export const DEFAULT_SETTINGS: Record<SettingKey, string> = {
  [SETTING_KEYS.gateOpenMs]: '3000',
  [SETTING_KEYS.accessCooldownSeconds]: '5',
  [SETTING_KEYS.defaultLateGraceMinutes]: '10',
  [SETTING_KEYS.evidenceRetentionDays]: '90',
  [SETTING_KEYS.failClosed]: 'true',
  [SETTING_KEYS.helmetMinConfidence]: '0.7',
  [SETTING_KEYS.vestMinConfidence]: '0.7',
  [SETTING_KEYS.uniformMinConfidence]: '0.65',
};
