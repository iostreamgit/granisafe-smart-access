import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../../settings/settings.service';

export type GateResult = {
  simulated: boolean;
  openMs: number;
};

@Injectable()
export class GateSimulationAdapter {
  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async open(companyId: string): Promise<GateResult> {
    const openMs = await this.settings.getGateOpenMs(companyId);
    const envFallback = Number(this.config.get('GATE_OPEN_MS') ?? 3000);
    const ms = Number.isFinite(openMs) ? openMs : Number.isFinite(envFallback) ? envFallback : 3000;
    return { simulated: true, openMs: ms };
  }

  closed(): GateResult {
    return { simulated: false, openMs: 0 };
  }
}
