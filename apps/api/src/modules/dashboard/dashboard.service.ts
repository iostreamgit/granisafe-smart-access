import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { AccessAttemptStatus, AccessDirection, PunchType } from '@granisafe/shared';
import type { AuthUser } from '../../shared/security/auth-user';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { SYSTEM_CAMERA_STATUS, type CameraStatusPayload } from './realtime.events';
import type { CameraHeartbeatDto } from './dto/camera-heartbeat.dto';

const CAMERA_STALE_MS = 60_000;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  async summary(actor: AuthUser) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [onSiteCount, entriesToday, deniedToday, cameras] = await Promise.all([
      this.countOnSite(actor.companyId),
      this.prisma.accessAttempt.count({
        where: {
          companyId: actor.companyId,
          status: AccessAttemptStatus.GRANTED,
          direction: AccessDirection.ENTRY,
          finishedAt: { gte: startOfDay },
        },
      }),
      this.prisma.accessAttempt.count({
        where: {
          companyId: actor.companyId,
          status: AccessAttemptStatus.DENIED,
          finishedAt: { gte: startOfDay },
        },
      }),
      this.prisma.cameraStatus.findMany({
        where: { companyId: actor.companyId },
        orderBy: { accessPointCode: 'asc' },
      }),
    ]);

    const now = Date.now();
    const cameraStatuses = cameras.map((cam) => {
      const stale = now - cam.lastHeartbeatAt.getTime() > CAMERA_STALE_MS;
      return {
        accessPointCode: cam.accessPointCode,
        status: stale ? 'OFFLINE' : cam.status,
        lastHeartbeatAt: cam.lastHeartbeatAt.toISOString(),
      };
    });

    return {
      onSiteCount,
      entriesToday,
      deniedToday,
      aiStatus: this.resolveAiStatus(),
      cameraStatuses,
      generatedAt: new Date().toISOString(),
    };
  }

  async heartbeat(actor: AuthUser, dto: CameraHeartbeatDto) {
    const code = dto.accessPointCode.trim() || 'GATE-1';
    const status = dto.status ?? 'ONLINE';
    const now = new Date();

    const row = await this.prisma.cameraStatus.upsert({
      where: {
        companyId_accessPointCode: {
          companyId: actor.companyId,
          accessPointCode: code,
        },
      },
      create: {
        companyId: actor.companyId,
        accessPointCode: code,
        status,
        lastHeartbeatAt: now,
      },
      update: {
        status,
        lastHeartbeatAt: now,
      },
    });

    const payload: CameraStatusPayload = {
      companyId: actor.companyId,
      accessPointCode: row.accessPointCode,
      status: row.status,
      lastHeartbeatAt: row.lastHeartbeatAt.toISOString(),
    };
    this.events.emit(SYSTEM_CAMERA_STATUS, payload);

    return payload;
  }

  private async countOnSite(companyId: string): Promise<number> {
    const employees = await this.prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      select: {
        attendanceRecords: {
          orderBy: { punchedAt: 'desc' },
          take: 1,
          select: { punchType: true },
        },
      },
    });
    return employees.filter((e) => e.attendanceRecords[0]?.punchType === PunchType.ENTRY).length;
  }

  private resolveAiStatus(): 'UP' | 'DOWN' | 'FAKE' {
    if ((this.config.get<string>('AI_KILL_SWITCH') ?? process.env.AI_KILL_SWITCH) === 'true') {
      return 'DOWN';
    }
    const adapter = (
      this.config.get<string>('AI_ADAPTER') ??
      process.env.AI_ADAPTER ??
      'fake'
    ).toLowerCase();
    return adapter === 'http' ? 'UP' : 'FAKE';
  }
}
