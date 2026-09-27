import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PpeClass } from '@granisafe/shared';
import type { AiDetectResult, AiDetectorPort } from '../ports/ai-detector.port';

const CLASS_MAP: Record<string, PpeClass> = {
  helmet: PpeClass.HELMET,
  hardhat: PpeClass.HELMET,
  hard_hat: PpeClass.HELMET,
  safety_vest: PpeClass.SAFETY_VEST,
  vest: PpeClass.SAFETY_VEST,
  uniform: PpeClass.UNIFORM,
};

const ALL_CLASSES = [PpeClass.HELMET, PpeClass.SAFETY_VEST, PpeClass.UNIFORM] as const;

type AiWireDetection = {
  class?: string;
  confidence?: number;
  bbox?: number[] | null;
};

@Injectable()
export class HttpAiAdapter implements AiDetectorPort {
  private readonly logger = new Logger(HttpAiAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async detect(input: {
    attemptId: string;
    scenario?: string;
    imageBuffer?: Buffer;
  }): Promise<AiDetectResult> {
    if (this.config.get<string>('AI_KILL_SWITCH') === 'true') {
      return {
        ok: false,
        code: 'AI_UNAVAILABLE',
        message: 'AI kill switch enabled',
      };
    }

    const baseUrl = (this.config.get<string>('AI_BASE_URL') ?? 'http://localhost:8000').replace(
      /\/$/,
      '',
    );
    const apiKey = this.config.get<string>('AI_API_KEY') ?? 'dev-ai-key-change-me';
    const timeoutMs = Number(this.config.get('AI_TIMEOUT_MS') ?? 3000);

    const imageBase64 = (input.imageBuffer ?? Buffer.from('phase5-stub-frame')).toString('base64');

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      Number.isFinite(timeoutMs) ? timeoutMs : 3000,
    );

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      };
      if (input.scenario) headers['X-Mock-Scenario'] = input.scenario;

      const response = await fetch(`${baseUrl}/v1/detect`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          requestId: input.attemptId,
          imageBase64,
          classes: ['helmet', 'safety_vest', 'uniform'],
        }),
        signal: controller.signal,
      });

      if (response.status === 422) {
        const body = (await response.json().catch(() => ({}))) as {
          detail?: { code?: string; message?: string } | string;
        };
        const detail = typeof body.detail === 'object' ? body.detail : undefined;
        return {
          ok: false,
          code: 'POOR_IMAGE_QUALITY',
          message: detail?.message ?? 'Poor image quality',
        };
      }

      if (response.status === 503) {
        return {
          ok: false,
          code: 'AI_UNAVAILABLE',
          message: 'AI service unavailable (503)',
        };
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.warn(`AI detect failed HTTP ${response.status}: ${text.slice(0, 200)}`);
        return {
          ok: false,
          code: 'AI_ERROR',
          message: `AI detect failed with status ${response.status}`,
        };
      }

      const payload = (await response.json()) as {
        inferenceMs?: number;
        detections?: AiWireDetection[];
      };

      return {
        ok: true,
        inferenceMs: Number(payload.inferenceMs ?? 0),
        detections: this.toDomainDetections(payload.detections ?? []),
      };
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      const message = error instanceof Error ? error.message : String(error);
      if (name === 'AbortError') {
        return { ok: false, code: 'AI_TIMEOUT', message: 'AI detect timed out' };
      }
      this.logger.warn(`AI detect unreachable: ${message}`);
      return {
        ok: false,
        code: 'AI_UNAVAILABLE',
        message: `AI service unreachable: ${message}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private toDomainDetections(raw: AiWireDetection[]) {
    const best = new Map<PpeClass, { confidence: number; bbox: number[] | null }>();

    for (const item of raw) {
      const key = (item.class ?? '').toLowerCase().replace(/-/g, '_');
      const ppeClass = CLASS_MAP[key];
      if (!ppeClass) continue;
      const confidence = Number(item.confidence ?? 0);
      const prev = best.get(ppeClass);
      if (!prev || confidence > prev.confidence) {
        best.set(ppeClass, {
          confidence,
          bbox: Array.isArray(item.bbox) ? item.bbox : null,
        });
      }
    }

    return ALL_CLASSES.map((ppeClass) => {
      const hit = best.get(ppeClass);
      const confidence = hit?.confidence ?? 0;
      const bbox = hit?.bbox;
      return {
        ppeClass,
        detected: confidence > 0 && (hit?.confidence ?? 0) >= 0.5,
        confidence,
        bbox: bbox && bbox.length >= 4 ? { x: bbox[0], y: bbox[1], w: bbox[2], h: bbox[3] } : null,
      };
    });
  }
}
