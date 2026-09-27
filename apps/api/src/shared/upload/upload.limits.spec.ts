import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INSPECT_FRAME_MAX_BYTES,
  isAllowedInspectMime,
  inspectFrameMulterOptions,
} from './upload.limits';

describe('inspect upload limits', () => {
  it('caps frame size at 3 MiB', () => {
    assert.equal(INSPECT_FRAME_MAX_BYTES, 3 * 1024 * 1024);
    assert.equal(inspectFrameMulterOptions().limits?.fileSize, INSPECT_FRAME_MAX_BYTES);
  });

  it('allows common image MIME types', () => {
    assert.equal(isAllowedInspectMime('image/jpeg'), true);
    assert.equal(isAllowedInspectMime('image/png'), true);
    assert.equal(isAllowedInspectMime('image/webp'), true);
  });

  it('rejects non-image MIME types', () => {
    assert.equal(isAllowedInspectMime('application/pdf'), false);
    assert.equal(isAllowedInspectMime('text/plain'), false);
    assert.equal(isAllowedInspectMime(undefined), false);
  });
});
