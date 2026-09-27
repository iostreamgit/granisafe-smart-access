import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ReportGeneratorService } from './report-generator.service';
import { ReportStorageService } from './report-storage.service';
import { REPORTS_QUEUE, type ReportJobPayload } from './reports.constants';

@Processor(REPORTS_QUEUE)
export class ReportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: ReportGeneratorService,
    private readonly storage: ReportStorageService,
  ) {
    super();
  }

  async process(job: Job<ReportJobPayload>): Promise<void> {
    const { jobId } = job.data;
    const row = await this.prisma.reportJob.findUnique({ where: { id: jobId } });
    if (!row) {
      this.logger.warn(`Report job ${jobId} missing`);
      return;
    }

    await this.prisma.reportJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING' },
    });

    try {
      const params = row.params as {
        from: string;
        to: string;
        departmentId?: string | null;
      };
      const generated = await this.generator.generate({
        companyId: row.companyId,
        type: row.type as 'ATTENDANCE' | 'REJECTIONS' | 'PPE_COMPLIANCE',
        format: row.format as 'XLSX' | 'PDF',
        params,
      });
      const key = ['reports', row.companyId, `${jobId}.${generated.extension}`].join('/');
      await this.storage.store(key, generated.buffer);
      await this.prisma.reportJob.update({
        where: { id: jobId },
        data: {
          status: 'SUCCEEDED',
          storageKey: key,
          completedAt: new Date(),
          error: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Report generation failed';
      this.logger.error(`Report job ${jobId} failed: ${message}`);
      await this.prisma.reportJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          error: message,
          completedAt: new Date(),
        },
      });
      throw err;
    }
  }
}
