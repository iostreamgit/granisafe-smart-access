import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { AuthUser } from '../../shared/security/auth-user';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { CreateReportDto } from './dto/create-report.dto';
import { ReportStorageService } from './report-storage.service';
import { REPORTS_QUEUE, type ReportJobPayload } from './reports.constants';

type ReportType = 'ATTENDANCE' | 'REJECTIONS' | 'PPE_COMPLIANCE';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ReportStorageService,
    @InjectQueue(REPORTS_QUEUE) private readonly queue: Queue<ReportJobPayload>,
  ) {}

  async enqueue(actor: AuthUser, type: ReportType, dto: CreateReportDto) {
    await this.assertRateLimit(actor.id);

    const job = await this.prisma.reportJob.create({
      data: {
        companyId: actor.companyId,
        requestedByUserId: actor.id,
        type,
        format: dto.format,
        status: 'QUEUED',
        params: {
          from: dto.from,
          to: dto.to,
          departmentId: dto.departmentId ?? null,
        },
      },
    });

    await this.queue.add(
      'generate',
      { jobId: job.id },
      { removeOnComplete: 100, removeOnFail: 50, attempts: 2 },
    );

    return { jobId: job.id, status: job.status as 'QUEUED' };
  }

  async getJob(actor: AuthUser, jobId: string) {
    const job = await this.prisma.reportJob.findFirst({
      where: { id: jobId, companyId: actor.companyId },
    });
    if (!job) {
      throw new NotFoundException({
        code: 'REPORT_NOT_FOUND',
        title: 'Not Found',
        detail: 'Report job not found',
      });
    }
    return {
      jobId: job.id,
      type: job.type,
      format: job.format,
      status: job.status,
      params: job.params,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
      downloadReady: job.status === 'SUCCEEDED' && !!job.storageKey,
    };
  }

  async download(actor: AuthUser, jobId: string) {
    const job = await this.prisma.reportJob.findFirst({
      where: { id: jobId, companyId: actor.companyId },
    });
    if (!job || job.status !== 'SUCCEEDED' || !job.storageKey) {
      throw new NotFoundException({
        code: 'REPORT_NOT_READY',
        title: 'Not Found',
        detail: 'Report is not ready for download',
      });
    }
    const buffer = await this.storage.read(job.storageKey);
    const ext = job.format === 'PDF' ? 'pdf' : 'xlsx';
    const contentType =
      job.format === 'PDF'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return {
      buffer,
      contentType,
      filename: `${job.type.toLowerCase()}-${job.id.slice(0, 8)}.${ext}`,
    };
  }

  private async assertRateLimit(userId: string) {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const count = await this.prisma.reportJob.count({
      where: { requestedByUserId: userId, createdAt: { gte: since } },
    });
    if (count >= 10) {
      throw new HttpException(
        {
          code: 'REPORT_RATE_LIMIT',
          title: 'Too Many Requests',
          detail: 'Maximum 10 report jobs per hour',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
