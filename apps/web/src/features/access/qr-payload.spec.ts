import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isGranisafeQrPayload } from './qr-payload';

describe('isGranisafeQrPayload', () => {
  it('accepts GSA v1 payloads', () => {
    assert.equal(isGranisafeQrPayload('GSA:v1:abc123'), true);
    assert.equal(isGranisafeQrPayload('  GSA:v1:xyz  '), true);
  });

  it('rejects other strings', () => {
    assert.equal(isGranisafeQrPayload('EMP-1001'), false);
    assert.equal(isGranisafeQrPayload('RFID-1001'), false);
    assert.equal(isGranisafeQrPayload(''), false);
  });
});
