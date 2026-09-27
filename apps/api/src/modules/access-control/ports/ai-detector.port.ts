import type { FakeAiScenario, PpeClass } from '@granisafe/shared';

export type AiDetection = {
  ppeClass: PpeClass;
  detected: boolean;
  confidence: number;
  bbox?: { x: number; y: number; w: number; h: number } | null;
};

export type AiFailureCode = 'AI_ERROR' | 'AI_UNAVAILABLE' | 'AI_TIMEOUT' | 'POOR_IMAGE_QUALITY';

export type AiDetectResult =
  | { ok: true; detections: AiDetection[]; inferenceMs: number }
  | { ok: false; code: AiFailureCode; message: string };

export interface AiDetectorPort {
  detect(input: {
    attemptId: string;
    scenario?: FakeAiScenario | string;
    imageBuffer?: Buffer;
  }): Promise<AiDetectResult>;
}

export const AI_DETECTOR = Symbol('AI_DETECTOR');
