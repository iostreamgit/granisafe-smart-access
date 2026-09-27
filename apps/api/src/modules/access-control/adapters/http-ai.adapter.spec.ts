import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { HttpAiAdapter } from './http-ai.adapter';

function config(map: Record<string, string>) {
  return {
    get: (key: string) => map[key],
  } as unknown as ConfigService;
}

describe('HttpAiAdapter', () => {
  it('maps successful detections to domain PPE classes', async () => {
    const fetchMock = mock.method(
      globalThis,
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            requestId: 'a1',
            inferenceMs: 10,
            detections: [
              { class: 'helmet', confidence: 0.91, bbox: [0.1, 0.1, 0.2, 0.2] },
              { class: 'vest', confidence: 0.88, bbox: [0.2, 0.2, 0.2, 0.2] },
              { class: 'uniform', confidence: 0.8, bbox: [0.3, 0.3, 0.2, 0.2] },
            ],
          }),
          { status: 200 },
        ),
    );

    const adapter = new HttpAiAdapter(
      config({
        AI_BASE_URL: 'http://ai.test',
        AI_API_KEY: 'k',
        AI_TIMEOUT_MS: '2000',
      }),
    );
    const result = await adapter.detect({ attemptId: 'a1', scenario: 'ALL_OK' });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.detections.length, 3);
      assert.equal(result.detections[0]?.ppeClass, 'HELMET');
      assert.equal(result.detections[0]?.detected, true);
    }
    fetchMock.mock.restore();
  });

  it('maps connection failure to AI_UNAVAILABLE', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => {
      throw new Error('connect ECONNREFUSED');
    });
    const adapter = new HttpAiAdapter(config({ AI_BASE_URL: 'http://ai.test', AI_API_KEY: 'k' }));
    const result = await adapter.detect({ attemptId: 'a1' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'AI_UNAVAILABLE');
    fetchMock.mock.restore();
  });

  it('honors AI kill switch', async () => {
    const adapter = new HttpAiAdapter(
      config({ AI_KILL_SWITCH: 'true', AI_BASE_URL: 'http://ai.test' }),
    );
    const result = await adapter.detect({ attemptId: 'a1' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'AI_UNAVAILABLE');
  });
});
