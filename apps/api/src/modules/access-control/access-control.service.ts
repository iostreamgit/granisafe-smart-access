import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AccessAttemptStatus,
  AccessDecision,
  AccessDirection,
  AccessIdentifyMethod,
  AttendanceSource,
  EmployeeStatus,
  IdentifierType,
  PunchType,
} from '@granisafe/shared';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../shared/audit/audit.service';
import { hashIdentifier } from '../../shared/identifiers/identifier.util';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthUser } from '../../shared/security/auth-user';
import { EvidenceStorageService } from '../../shared/storage/evidence-storage.service';
import { computeIsLate } from '../attendance/late.util';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { GateSimulationAdapter } from './adapters/gate-simulation.adapter';
import { AccessDecisionService } from './decision.service';
import type { AccessEventsQueryDto } from './dto/events-query.dto';
import type { IdentifyDto } from './dto/identify.dto';
import { ACCESS_EVENT_CREATED, type AccessEventCreatedPayload } from '../dashboard/realtime.events';
import { AI_DETECTOR, type AiDetectorPort } from './ports/ai-detector.port';

@Injectable()
export class AccessControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly decisionService: AccessDecisionService,
    private readonly gate: GateSimulationAdapter,
    private readonly evidence: EvidenceStorageService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    @Inject(AI_DETECTOR) private readonly ai: AiDetectorPort,
  ) {}

  aiStatus() {
    const adapter = (
      this.config.get<string>('AI_ADAPTER') ??
      process.env.AI_ADAPTER ??
      'fake'
    ).toLowerCase();
    return {
      adapter: adapter === 'http' ? 'http' : 'fake',
      baseUrl: this.config.get<string>('AI_BASE_URL') ?? process.env.AI_BASE_URL ?? null,
      killSwitch:
        (this.config.get<string>('AI_KILL_SWITCH') ?? process.env.AI_KILL_SWITCH) === 'true',
      timeoutMs: Number(this.config.get('AI_TIMEOUT_MS') ?? process.env.AI_TIMEOUT_MS ?? 3000),
    };
  }

  async identify(actor: AuthUser, dto: IdentifyDto) {
    const employee = await this.resolveEmployee(actor.companyId, dto);
    if (employee.status !== EmployeeStatus.ACTIVE || employee.deletedAt) {
      throw new UnprocessableEntityException({
        code: 'EMPLOYEE_INACTIVE',
        title: 'Unprocessable Entity',
        detail: 'Employee is inactive and cannot access the site',
      });
    }

    await this.assertAccessCooldown(actor.companyId, employee.id);

    const policy = await this.prisma.ppePolicy.findFirst({
      where: { companyId: actor.companyId, isDefault: true },
      include: { items: true },
    });
    if (!policy) {
      throw new BadRequestException({
        code: 'PPE_POLICY_MISSING',
        title: 'Bad Request',
        detail: 'Default PPE policy is not configured',
      });
    }

    const attempt = await this.prisma.accessAttempt.create({
      data: {
        companyId: actor.companyId,
        employeeId: employee.id,
        direction: dto.direction,
        status: AccessAttemptStatus.IN_PROGRESS,
        policyId: policy.id,
        policyVersion: policy.version,
        accessPointCode: dto.accessPointCode?.trim() || 'GATE-1',
        correlationId: randomUUID(),
      },
    });

    await this.audit.write({
      companyId: actor.companyId,
      actorUserId: actor.id,
      action: 'ACCESS_IDENTIFY',
      entityType: 'access_attempt',
      entityId: attempt.id,
      metadata: {
        employeeId: employee.id,
        direction: dto.direction,
        method: dto.method,
      },
    });

    return {
      attemptId: attempt.id,
      employee: {
        id: employee.id,
        fullName: `${employee.firstName} ${employee.lastName}`,
        employeeCode: employee.employeeCode,
        departmentName: employee.department?.name ?? null,
      },
      requiredPpe: policy.items.filter((i) => i.required).map((i) => i.ppeClass),
      direction: attempt.direction,
    };
  }

  async inspect(
    actor: AuthUser,
    input: {
      attemptId: string;
      mockScenario?: string;
      frame?: Express.Multer.File;
      idempotencyKey?: string;
    },
  ) {
    if (!input.attemptId?.trim()) {
      throw new BadRequestException({
        code: 'ATTEMPT_ID_REQUIRED',
        title: 'Bad Request',
        detail: 'attemptId is required',
      });
    }

    const attempt = await this.prisma.accessAttempt.findFirst({
      where: { id: input.attemptId, companyId: actor.companyId },
      include: {
        employee: true,
        policy: { include: { items: true } },
        decision: true,
        detections: true,
        attendanceRecord: true,
      },
    });

    if (!attempt) {
      throw new NotFoundException({
        code: 'ATTEMPT_NOT_FOUND',
        title: 'Not Found',
        detail: 'Access attempt not found',
      });
    }

    if (attempt.status !== AccessAttemptStatus.IN_PROGRESS && attempt.decision) {
      return this.toInspectResponse(attempt);
    }

    if (input.idempotencyKey) {
      const existingKey = await this.prisma.accessAttempt.findFirst({
        where: {
          companyId: actor.companyId,
          idempotencyKey: input.idempotencyKey,
          NOT: { id: attempt.id },
        },
      });
      if (existingKey) {
        throw new BadRequestException({
          code: 'IDEMPOTENCY_CONFLICT',
          title: 'Bad Request',
          detail: 'Idempotency key already used for another attempt',
        });
      }
    }

    let evidenceKey: string | null = null;
    if (input.frame?.buffer?.length) {
      evidenceKey = await this.evidence.storeFrame({
        companyId: actor.companyId,
        attemptId: attempt.id,
        buffer: input.frame.buffer,
        contentType: input.frame.mimetype,
      });
    } else {
      // Allow stub inspect without a camera frame in Phase 5 demos.
      evidenceKey = await this.evidence.storeFrame({
        companyId: actor.companyId,
        attemptId: attempt.id,
        buffer: Buffer.from('phase5-stub-frame'),
        contentType: 'image/jpeg',
      });
    }

    const ai = await this.ai.detect({
      attemptId: attempt.id,
      scenario: input.mockScenario?.trim() || undefined,
      imageBuffer: input.frame?.buffer,
    });

    if (!ai.ok) {
      await this.audit.write({
        companyId: actor.companyId,
        actorUserId: actor.id,
        action: 'AI_DOWN',
        entityType: 'access_attempt',
        entityId: attempt.id,
        metadata: {
          code: ai.code,
          message: ai.message,
          adapter: this.aiStatus().adapter,
        },
      });
      await this.notifications.notifyAiUnavailable(
        actor.companyId,
        ai.message || 'AI detector unavailable',
      );
    }

    const policyItems = (attempt.policy?.items ?? []).map((item) => ({
      ppeClass: item.ppeClass,
      required: item.required,
      minConfidence: Number(item.minConfidence),
    }));

    const evaluated = this.decisionService.evaluate({ ai, policyItems });
    const granted = evaluated.decision === AccessDecision.GRANTED;
    const gate = granted ? await this.gate.open(actor.companyId) : this.gate.closed();

    const detections = ai.ok
      ? ai.detections
      : policyItems.map((item) => ({
          ppeClass: item.ppeClass as never,
          detected: false,
          confidence: 0,
          bbox: null,
        }));

    const finishedAt = new Date();
    let attendance: { id: string; punchType: string; isLate: boolean } | null = null;

    await this.prisma.$transaction(async (tx) => {
      await tx.accessDetectionItem.createMany({
        data: detections.map((d) => ({
          accessAttemptId: attempt.id,
          ppeClass: d.ppeClass,
          detected: d.detected,
          confidence: new Prisma.Decimal(d.confidence),
          bbox: d.bbox ?? Prisma.JsonNull,
        })),
      });

      await tx.accessDecisionRecord.create({
        data: {
          accessAttemptId: attempt.id,
          decision: evaluated.decision,
          reasons: evaluated.reasons,
          gateSimulated: gate.simulated,
          gateOpenMs: gate.openMs,
          decidedAt: finishedAt,
        },
      });

      await tx.accessAttempt.update({
        where: { id: attempt.id },
        data: {
          status: granted ? AccessAttemptStatus.GRANTED : AccessAttemptStatus.DENIED,
          evidenceObjectKey: evidenceKey,
          finishedAt,
          idempotencyKey: input.idempotencyKey || undefined,
        },
      });

      if (granted && attempt.direction === AccessDirection.ENTRY) {
        const isLate = computeIsLate(
          PunchType.ENTRY,
          finishedAt,
          attempt.employee.shiftStart,
          attempt.employee.lateGraceMinutes,
        );
        const row = await tx.attendanceRecord.create({
          data: {
            companyId: actor.companyId,
            employeeId: attempt.employeeId,
            accessAttemptId: attempt.id,
            punchType: PunchType.ENTRY,
            punchedAt: finishedAt,
            isLate,
            source: AttendanceSource.ACCESS_GRANT,
          },
        });
        attendance = { id: row.id, punchType: row.punchType, isLate: row.isLate };
      }

      if (granted && attempt.direction === AccessDirection.EXIT) {
        const row = await tx.attendanceRecord.create({
          data: {
            companyId: actor.companyId,
            employeeId: attempt.employeeId,
            accessAttemptId: attempt.id,
            punchType: PunchType.EXIT,
            punchedAt: finishedAt,
            isLate: false,
            source: AttendanceSource.ACCESS_GRANT,
          },
        });
        attendance = { id: row.id, punchType: row.punchType, isLate: row.isLate };
      }
    });

    await this.audit.write({
      companyId: actor.companyId,
      actorUserId: actor.id,
      action: granted ? 'ACCESS_GRANTED' : 'ACCESS_DENIED',
      entityType: 'access_attempt',
      entityId: attempt.id,
      metadata: {
        decision: evaluated.decision,
        reasons: evaluated.reasons,
        direction: attempt.direction,
        attendanceRecorded: Boolean(attendance),
      },
    });

    const realtimePayload: AccessEventCreatedPayload = {
      companyId: actor.companyId,
      event: {
        id: attempt.id,
        direction: attempt.direction,
        status: granted ? AccessAttemptStatus.GRANTED : AccessAttemptStatus.DENIED,
        decision: evaluated.decision,
        startedAt: attempt.startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        accessPointCode: attempt.accessPointCode,
        employee: {
          id: attempt.employee.id,
          employeeCode: attempt.employee.employeeCode,
          fullName: `${attempt.employee.firstName} ${attempt.employee.lastName}`,
        },
        reasons: evaluated.reasons,
      },
    };
    this.events.emit(ACCESS_EVENT_CREATED, realtimePayload);

    return {
      attemptId: attempt.id,
      decision: evaluated.decision,
      reasons: evaluated.reasons,
      detections: detections.map((d) => ({
        ppeClass: d.ppeClass,
        detected: d.detected,
        confidence: d.confidence,
      })),
      gate,
      attendanceRecorded: Boolean(attendance),
      attendance,
    };
  }

  async listEvents(actor: AuthUser, query: AccessEventsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.AccessAttemptWhereInput = { companyId: actor.companyId };
    if (query.status) where.status = query.status;
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.from || query.to) {
      where.startedAt = {};
      if (query.from) {
        const from = new Date(query.from);
        if (!Number.isNaN(from.getTime())) where.startedAt.gte = from;
      }
      if (query.to) {
        const to = new Date(query.to);
        if (!Number.isNaN(to.getTime())) where.startedAt.lte = to;
      }
    }

    const [total, rows] = await Promise.all([
      this.prisma.accessAttempt.count({ where }),
      this.prisma.accessAttempt.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
            },
          },
          decision: true,
        },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => this.toEventSummary(row)),
      page,
      pageSize,
      total,
    };
  }

  async getEvent(actor: AuthUser, id: string) {
    const row = await this.prisma.accessAttempt.findFirst({
      where: { id, companyId: actor.companyId },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true, code: true } },
          },
        },
        decision: true,
        detections: true,
        attendanceRecord: true,
        policy: { select: { id: true, name: true, version: true } },
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'ATTEMPT_NOT_FOUND',
        title: 'Not Found',
        detail: 'Access event not found',
      });
    }
    return {
      ...this.toEventSummary(row),
      accessPointCode: row.accessPointCode,
      correlationId: row.correlationId,
      evidenceObjectKey: row.evidenceObjectKey,
      policy: row.policy,
      detections: row.detections.map((d) => ({
        ppeClass: d.ppeClass,
        detected: d.detected,
        confidence: Number(d.confidence),
      })),
      attendance: row.attendanceRecord
        ? {
            id: row.attendanceRecord.id,
            punchType: row.attendanceRecord.punchType,
            isLate: row.attendanceRecord.isLate,
            punchedAt: row.attendanceRecord.punchedAt.toISOString(),
          }
        : null,
    };
  }

  private async assertAccessCooldown(companyId: string, employeeId: string) {
    const cooldownSec = await this.settings.getAccessCooldownSeconds(companyId);
    if (cooldownSec <= 0) return;

    const since = new Date(Date.now() - cooldownSec * 1000);
    const recent = await this.prisma.accessAttempt.findFirst({
      where: {
        companyId,
        employeeId,
        finishedAt: { gte: since },
        status: {
          in: [AccessAttemptStatus.GRANTED, AccessAttemptStatus.DENIED],
        },
      },
      orderBy: { finishedAt: 'desc' },
    });
    if (recent) {
      throw new UnprocessableEntityException({
        code: 'ACCESS_COOLDOWN',
        title: 'Unprocessable Entity',
        detail: `Duplicate scan blocked — wait ${cooldownSec}s between attempts`,
      });
    }
  }

  private async resolveEmployee(companyId: string, dto: IdentifyDto) {
    if (dto.method === AccessIdentifyMethod.EMPLOYEE_CODE) {
      const employee = await this.prisma.employee.findFirst({
        where: {
          companyId,
          employeeCode: dto.identifier.trim().toUpperCase(),
          deletedAt: null,
        },
        include: { department: true },
      });
      if (!employee) {
        throw new NotFoundException({
          code: 'UNKNOWN_IDENTIFIER',
          title: 'Not Found',
          detail: 'Unknown employee code',
        });
      }
      return employee;
    }

    const type = dto.method === AccessIdentifyMethod.RFID ? IdentifierType.RFID : IdentifierType.QR;
    const valueHash = hashIdentifier(dto.identifier.trim());
    const identifier = await this.prisma.employeeIdentifier.findFirst({
      where: { type, valueHash, isActive: true },
      include: {
        employee: { include: { department: true } },
      },
    });

    if (!identifier || identifier.employee.companyId !== companyId) {
      throw new NotFoundException({
        code: 'UNKNOWN_IDENTIFIER',
        title: 'Not Found',
        detail: 'Unknown identifier',
      });
    }

    return identifier.employee;
  }

  private toInspectResponse(attempt: {
    id: string;
    decision: {
      decision: string;
      reasons: Prisma.JsonValue;
      gateSimulated: boolean;
      gateOpenMs: number;
    } | null;
    detections: Array<{ ppeClass: string; detected: boolean; confidence: Prisma.Decimal }>;
    attendanceRecord: { id: string; punchType: string; isLate: boolean } | null;
  }) {
    const decision = attempt.decision!;
    return {
      attemptId: attempt.id,
      decision: decision.decision,
      reasons: decision.reasons,
      detections: attempt.detections.map((d) => ({
        ppeClass: d.ppeClass,
        detected: d.detected,
        confidence: Number(d.confidence),
      })),
      gate: { simulated: decision.gateSimulated, openMs: decision.gateOpenMs },
      attendanceRecorded: Boolean(attempt.attendanceRecord),
      attendance: attempt.attendanceRecord
        ? {
            id: attempt.attendanceRecord.id,
            punchType: attempt.attendanceRecord.punchType,
            isLate: attempt.attendanceRecord.isLate,
          }
        : null,
    };
  }

  private toEventSummary(row: {
    id: string;
    direction: string;
    status: string;
    accessPointCode: string;
    startedAt: Date;
    finishedAt: Date | null;
    employee: {
      id: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
    };
    decision: {
      decision: string;
      reasons: Prisma.JsonValue;
      gateSimulated: boolean;
      gateOpenMs: number;
    } | null;
  }) {
    return {
      id: row.id,
      direction: row.direction,
      status: row.status,
      accessPointCode: row.accessPointCode,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
      employee: {
        id: row.employee.id,
        employeeCode: row.employee.employeeCode,
        fullName: `${row.employee.firstName} ${row.employee.lastName}`,
      },
      decision: row.decision
        ? {
            decision: row.decision.decision,
            reasons: row.decision.reasons,
            gate: {
              simulated: row.decision.gateSimulated,
              openMs: row.decision.gateOpenMs,
            },
          }
        : null,
    };
  }
}
