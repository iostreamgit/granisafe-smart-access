import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PpeClass } from '@granisafe/shared';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../shared/audit/audit.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthUser } from '../../shared/security/auth-user';
import type { UpdateSettingsDto } from './dto/update-settings.dto';
import { DEFAULT_SETTINGS, SETTING_KEYS } from './settings.keys';

export type CompanySettingsView = {
  gateOpenMs: number;
  accessCooldownSeconds: number;
  defaultLateGraceMinutes: number;
  evidenceRetentionDays: number;
  failClosed: boolean;
  ppeThresholds: {
    helmet: number;
    safetyVest: number;
    uniform: number;
  };
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async ensureDefaults(companyId: string): Promise<void> {
    await Promise.all(
      Object.entries(DEFAULT_SETTINGS).map(([key, value]) =>
        this.prisma.systemSetting.upsert({
          where: { companyId_key: { companyId, key } },
          create: { companyId, key, value },
          update: {},
        }),
      ),
    );
  }

  async getString(companyId: string, key: string, fallback: string): Promise<string> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { companyId_key: { companyId, key } },
    });
    return row?.value ?? fallback;
  }

  async getNumber(companyId: string, key: string, fallback: number): Promise<number> {
    const raw = await this.getString(companyId, key, String(fallback));
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  async getGateOpenMs(companyId: string): Promise<number> {
    const envFallback = Number(this.config.get('GATE_OPEN_MS') ?? 3000);
    return this.getNumber(
      companyId,
      SETTING_KEYS.gateOpenMs,
      Number.isFinite(envFallback) ? envFallback : 3000,
    );
  }

  async getAccessCooldownSeconds(companyId: string): Promise<number> {
    return this.getNumber(companyId, SETTING_KEYS.accessCooldownSeconds, 5);
  }

  async getView(companyId: string): Promise<CompanySettingsView> {
    await this.ensureDefaults(companyId);
    const rows = await this.prisma.systemSetting.findMany({ where: { companyId } });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const num = (key: string, fallback: number) => {
      const n = Number(map.get(key) ?? fallback);
      return Number.isFinite(n) ? n : fallback;
    };
    return {
      gateOpenMs: num(SETTING_KEYS.gateOpenMs, 3000),
      accessCooldownSeconds: num(SETTING_KEYS.accessCooldownSeconds, 5),
      defaultLateGraceMinutes: num(SETTING_KEYS.defaultLateGraceMinutes, 10),
      evidenceRetentionDays: num(SETTING_KEYS.evidenceRetentionDays, 90),
      failClosed: (map.get(SETTING_KEYS.failClosed) ?? 'true') === 'true',
      ppeThresholds: {
        helmet: num(SETTING_KEYS.helmetMinConfidence, 0.7),
        safetyVest: num(SETTING_KEYS.vestMinConfidence, 0.7),
        uniform: num(SETTING_KEYS.uniformMinConfidence, 0.65),
      },
    };
  }

  async update(actor: AuthUser, dto: UpdateSettingsDto): Promise<CompanySettingsView> {
    await this.ensureDefaults(actor.companyId);

    const upserts: Array<{ key: string; value: string }> = [];
    if (dto.gateOpenMs !== undefined) {
      upserts.push({ key: SETTING_KEYS.gateOpenMs, value: String(dto.gateOpenMs) });
    }
    if (dto.accessCooldownSeconds !== undefined) {
      upserts.push({
        key: SETTING_KEYS.accessCooldownSeconds,
        value: String(dto.accessCooldownSeconds),
      });
    }
    if (dto.defaultLateGraceMinutes !== undefined) {
      upserts.push({
        key: SETTING_KEYS.defaultLateGraceMinutes,
        value: String(dto.defaultLateGraceMinutes),
      });
    }
    if (dto.evidenceRetentionDays !== undefined) {
      upserts.push({
        key: SETTING_KEYS.evidenceRetentionDays,
        value: String(dto.evidenceRetentionDays),
      });
    }
    if (dto.failClosed !== undefined) {
      upserts.push({
        key: SETTING_KEYS.failClosed,
        value: dto.failClosed ? 'true' : 'false',
      });
    }
    if (dto.ppeThresholds?.helmet !== undefined) {
      upserts.push({
        key: SETTING_KEYS.helmetMinConfidence,
        value: String(dto.ppeThresholds.helmet),
      });
    }
    if (dto.ppeThresholds?.safetyVest !== undefined) {
      upserts.push({
        key: SETTING_KEYS.vestMinConfidence,
        value: String(dto.ppeThresholds.safetyVest),
      });
    }
    if (dto.ppeThresholds?.uniform !== undefined) {
      upserts.push({
        key: SETTING_KEYS.uniformMinConfidence,
        value: String(dto.ppeThresholds.uniform),
      });
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of upserts) {
        await tx.systemSetting.upsert({
          where: {
            companyId_key: { companyId: actor.companyId, key: item.key },
          },
          create: {
            companyId: actor.companyId,
            key: item.key,
            value: item.value,
          },
          update: { value: item.value },
        });
      }

      const policy = await tx.ppePolicy.findFirst({
        where: { companyId: actor.companyId, isDefault: true },
        include: { items: true },
      });
      if (policy && dto.ppeThresholds) {
        const updates: Array<{ ppeClass: string; minConfidence: number }> = [];
        if (dto.ppeThresholds.helmet !== undefined) {
          updates.push({
            ppeClass: PpeClass.HELMET,
            minConfidence: dto.ppeThresholds.helmet,
          });
        }
        if (dto.ppeThresholds.safetyVest !== undefined) {
          updates.push({
            ppeClass: PpeClass.SAFETY_VEST,
            minConfidence: dto.ppeThresholds.safetyVest,
          });
        }
        if (dto.ppeThresholds.uniform !== undefined) {
          updates.push({
            ppeClass: PpeClass.UNIFORM,
            minConfidence: dto.ppeThresholds.uniform,
          });
        }
        for (const u of updates) {
          await tx.ppePolicyItem.updateMany({
            where: { policyId: policy.id, ppeClass: u.ppeClass },
            data: { minConfidence: new Prisma.Decimal(u.minConfidence) },
          });
        }
      }

      if (dto.defaultLateGraceMinutes !== undefined) {
        await tx.employee.updateMany({
          where: { companyId: actor.companyId, deletedAt: null },
          data: { lateGraceMinutes: dto.defaultLateGraceMinutes },
        });
      }
    });

    await this.audit.write({
      companyId: actor.companyId,
      actorUserId: actor.id,
      action: 'SETTINGS_UPDATED',
      entityType: 'system_settings',
      metadata: JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue,
    });

    return this.getView(actor.companyId);
  }
}
