import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ReportGeneratorService } from './report-generator.service';
import { ReportStorageService } from './report-storage.service';
import { REPORTS_QUEUE } from './reports.constants';
import { ReportsController } from './reports.controller';
import { ReportsProcessor } from './reports.processor';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL') ?? process.env.REDIS_URL ?? 'redis://localhost:6379',
        },
      }),
    }),
    BullModule.registerQueue({ name: REPORTS_QUEUE }),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsProcessor, ReportGeneratorService, ReportStorageService],
})
export class ReportsModule {}
