import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AccessDecision, PpeClass } from '@granisafe/shared';
import { AccessDecisionService } from './decision.service';

const policy = [
  { ppeClass: PpeClass.HELMET, required: true, minConfidence: 0.7 },
  { ppeClass: PpeClass.SAFETY_VEST, required: true, minConfidence: 0.7 },
  { ppeClass: PpeClass.UNIFORM, required: true, minConfidence: 0.65 },
];

describe('AccessDecisionService', () => {
  const service = new AccessDecisionService();

  it('grants when all required PPE meet thresholds', () => {
    const result = service.evaluate({
      ai: {
        ok: true,
        inferenceMs: 1,
        detections: [
          { ppeClass: PpeClass.HELMET, detected: true, confidence: 0.9 },
          { ppeClass: PpeClass.SAFETY_VEST, detected: true, confidence: 0.9 },
          { ppeClass: PpeClass.UNIFORM, detected: true, confidence: 0.9 },
        ],
      },
      policyItems: policy,
    });
    assert.equal(result.decision, AccessDecision.GRANTED);
    assert.equal(result.reasons.length, 0);
  });

  it('denies missing helmet fail-closed', () => {
    const result = service.evaluate({
      ai: {
        ok: true,
        inferenceMs: 1,
        detections: [
          { ppeClass: PpeClass.HELMET, detected: false, confidence: 0.2 },
          { ppeClass: PpeClass.SAFETY_VEST, detected: true, confidence: 0.9 },
          { ppeClass: PpeClass.UNIFORM, detected: true, confidence: 0.9 },
        ],
      },
      policyItems: policy,
    });
    assert.equal(result.decision, AccessDecision.DENIED);
    assert.equal(result.reasons[0]?.code, 'MISSING_PPE');
  });

  it('denies on AI error', () => {
    const result = service.evaluate({
      ai: { ok: false, code: 'AI_ERROR', message: 'down' },
      policyItems: policy,
    });
    assert.equal(result.decision, AccessDecision.DENIED);
    assert.equal(result.reasons[0]?.code, 'AI_ERROR');
  });
});
