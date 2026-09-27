export const QR_SCAN_DEBOUNCE_MS = 2000;
export const GSA_QR_PREFIX = 'GSA:v1:';

export function isGranisafeQrPayload(text: string): boolean {
  return text.trim().startsWith(GSA_QR_PREFIX);
}
