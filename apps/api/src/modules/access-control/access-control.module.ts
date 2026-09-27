import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EvidenceStorageService } from '../../shared/storage/evidence-storage.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { FakeAiAdapter } from './adapters/fake-ai.adapter';
import { GateSimulationAdapter } from './adapters/gate-simulation.adapter';
import { HttpAiAdapter } from './adapters/http-ai.adapter';
import { AccessControlController } from './access-control.controller';
import { AccessControlService } from './access-control.service';
import { AccessDecisionService } from './decision.service';
import { AI_DETECTOR } from './ports/ai-detector.port';

@Module({
  imports: [ConfigModule, SettingsModule, NotificationsModule],
  controllers: [AccessControlController],
  providers: [
    AccessControlService,
    AccessDecisionService,
    FakeAiAdapter,
    HttpAiAdapter,
    GateSimulationAdapter,
    EvidenceStorageService,
    {
      provide: AI_DETECTOR,
      inject: [ConfigService, FakeAiAdapter, HttpAiAdapter],
      useFactory: (config: ConfigService, fake: FakeAiAdapter, http: HttpAiAdapter) => {
        const mode = (
          config.get<string>('AI_ADAPTER') ??
          process.env.AI_ADAPTER ??
          'fake'
        ).toLowerCase();
        return mode === 'http' ? http : fake;
      },
    },
  ],
  exports: [AccessControlService],
})
export class AccessControlModule {}
