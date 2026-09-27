import { createHash, randomBytes } from 'node:crypto';
import QRCode from 'qrcode';

export function hashIdentifier(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function displayHint(value: string): string {
  const cleaned = value.replace(/\s+/g, '');
  return cleaned.slice(-4).padStart(Math.min(4, cleaned.length), '*');
}

export function createQrPayload(): string {
  return `GSA:v1:${randomBytes(24).toString('base64url')}`;
}

export async function qrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: { dark: '#0f1714', light: '#ffffff' },
  });
}
