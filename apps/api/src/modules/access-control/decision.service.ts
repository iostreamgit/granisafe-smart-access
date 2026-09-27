import { Injectable } from '@nestjs/common';
import { AccessDecision, PpeClass } from '@granisafe/shared';
import type { AiDetection, AiDetectResult } from './ports/ai-detector.port';

export type PolicyItem = {
  ppeClass: string;
  required: boolean;
  minConfidence: number;
};

export type DecisionReason = {
  code: string;
  ppeClass?: string;
  message: string;
};

export type DecisionResult = {
  decision: AccessDecision;
  reasons: DecisionReason[];
};

@Injectable()
export class AccessDecisionService {
  evaluate(input: { ai: AiDetectResult; policyItems: PolicyItem[] }): DecisionResult {
    if (!input.ai.ok) {
      return {
        decision: AccessDecision.DENIED,
        reasons: [
          {
            code: input.ai.code,
            message: input.ai.message || 'AI unavailable — fail closed',
          },
        ],
      };
    }

    const byClass = new Map<string, AiDetection>(input.ai.detections.map((d) => [d.ppeClass, d]));
    const reasons: DecisionReason[] = [];

    for (const item of input.policyItems) {
      if (!item.required) continue;
      const detection = byClass.get(item.ppeClass);
      const confidence = detection?.confidence ?? 0;
      const detected = Boolean(detection?.detected) && confidence >= item.minConfidence;
      if (!detected) {
        reasons.push({
          code: 'MISSING_PPE',
          ppeClass: item.ppeClass,
          message: `${this.label(item.ppeClass)} not detected`,
        });
      }
    }

    if (reasons.length > 0) {
      return { decision: AccessDecision.DENIED, reasons };
    }

    return { decision: AccessDecision.GRANTED, reasons: [] };
  }

  private label(ppeClass: string): string {
    switch (ppeClass) {
      case PpeClass.HELMET:
        return 'Helmet';
      case PpeClass.SAFETY_VEST:
        return 'Safety vest';
      case PpeClass.UNIFORM:
        return 'Uniform';
      default:
        return ppeClass;
    }
  }
}
