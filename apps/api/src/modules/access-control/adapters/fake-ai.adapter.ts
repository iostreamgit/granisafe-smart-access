import { Injectable } from '@nestjs/common';
import { FakeAiScenario, PpeClass } from '@granisafe/shared';
import type { AiDetection, AiDetectorPort, AiDetectResult } from '../ports/ai-detector.port';

const ALL_CLASSES = [PpeClass.HELMET, PpeClass.SAFETY_VEST, PpeClass.UNIFORM] as const;

@Injectable()
export class FakeAiAdapter implements AiDetectorPort {
  async detect(input: {
    attemptId: string;
    scenario?: FakeAiScenario | string;
    imageBuffer?: Buffer;
  }): Promise<AiDetectResult> {
    void input.attemptId;
    void input.imageBuffer;

    const raw = (input.scenario ?? '').toString().trim();
    // Camera mode (no scenario): fail-closed — do not invent PPE detections.
    const scenario = (raw || FakeAiScenario.NONE) as FakeAiScenario | string;

    if (scenario === FakeAiScenario.AI_ERROR) {
      return { ok: false, code: 'AI_ERROR', message: 'Fake AI forced error' };
    }

    const missing = new Set<string>();
    if (scenario === FakeAiScenario.ALL_OK) {
      /* none missing */
    } else if (scenario === FakeAiScenario.MISSING_HELMET) {
      missing.add(PpeClass.HELMET);
    } else if (scenario === FakeAiScenario.MISSING_VEST) {
      missing.add(PpeClass.SAFETY_VEST);
    } else if (scenario === FakeAiScenario.MISSING_UNIFORM) {
      missing.add(PpeClass.UNIFORM);
    } else {
      // NONE / unknown / empty → all missing
      missing.add(PpeClass.HELMET);
      missing.add(PpeClass.SAFETY_VEST);
      missing.add(PpeClass.UNIFORM);
    }

    const detections: AiDetection[] = ALL_CLASSES.map((ppeClass) => {
      const isMissing = missing.has(ppeClass);
      return {
        ppeClass,
        detected: !isMissing,
        confidence: isMissing ? 0.22 : 0.91,
        bbox: isMissing ? null : { x: 0.1, y: 0.1, w: 0.3, h: 0.3 },
      };
    });

    return { ok: true, detections, inferenceMs: 12 };
  }
}
