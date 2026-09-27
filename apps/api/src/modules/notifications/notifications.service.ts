import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RoleCode } from '@granisafe/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthUser } from '../../shared/security/auth-user';
import {
  ACCESS_EVENT_CREATED,
  SYSTEM_CAMERA_STATUS,
  type AccessEventCreatedPayload,
  type CameraStatusPayload,
} from '../dashboard/realtime.events';

export const NOTIFICATION_CREATED = 'notification.created';

export type NotificationType = 'ACCESS_DENIED' | 'CAMERA_OFFLINE' | 'AI_UNAVAILABLE' | 'SYSTEM';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async list(
    actor: AuthUser,
    opts: {
      page?: number;
      pageSize?: number;
      type?: string;
      isRead?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    const take = Math.min(Math.max(opts.pageSize ?? 20, 1), 100);
    const skip = (Math.max(opts.page ?? 1, 1) - 1) * take;

    const createdAt: Prisma.DateTimeFilter = {};
    if (opts.from) {
      const d = new Date(opts.from);
      if (!Number.isNaN(d.getTime())) createdAt.gte = d;
    }
    if (opts.to) {
      const d = new Date(opts.to);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        createdAt.lte = d;
      }
    }

    const baseWhere = { userId: actor.id, companyId: actor.companyId };
    const where: Prisma.NotificationWhereInput = {
      ...baseWhere,
      ...(opts.type?.trim() ? { type: opts.type.trim() } : {}),
      ...(opts.isRead === 'true' || opts.isRead === 'false'
        ? { isRead: opts.isRead === 'true' }
        : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    };

    const [total, unreadCount, data] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...baseWhere, isRead: false } }),
      this.prisma.notification.findMany({
        where,
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
    ]);

    return {
      data,
      meta: {
        page: Math.floor(skip / take) + 1,
        pageSize: take,
        total,
        unreadCount,
      },
    };
  }

  async markRead(actor: AuthUser, id: string) {
    const row = await this.prisma.notification.findFirst({
      where: { id, userId: actor.id, companyId: actor.companyId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        title: 'Not Found',
        detail: 'Notification not found',
      });
    }
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(actor: AuthUser) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: actor.id, companyId: actor.companyId, isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }

  async notifyRoles(input: {
    companyId: string;
    roles: string[];
    type: NotificationType;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }) {
    const users = await this.prisma.user.findMany({
      where: {
        companyId: input.companyId,
        isActive: true,
        deletedAt: null,
        roles: { some: { role: { code: { in: input.roles } } } },
      },
      select: { id: true },
    });

    if (!users.length) return;

    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        companyId: input.companyId,
        userId: u.id,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: input.payload ? (input.payload as Prisma.InputJsonValue) : Prisma.JsonNull,
      })),
    });

    this.events.emit(NOTIFICATION_CREATED, {
      companyId: input.companyId,
      userIds: users.map((u) => u.id),
      type: input.type,
      title: input.title,
    });
  }

  async notifyAiUnavailable(companyId: string, detail: string) {
    await this.notifyRoles({
      companyId,
      roles: [RoleCode.ADMIN, RoleCode.SUPERVISOR, RoleCode.GUARD],
      type: 'AI_UNAVAILABLE',
      title: 'AI unavailable',
      body: detail,
      payload: { code: 'AI_DOWN' },
    });
  }

  @OnEvent(ACCESS_EVENT_CREATED)
  async onAccessEvent(payload: AccessEventCreatedPayload) {
    if (payload.event.status !== 'DENIED' && payload.event.decision !== 'DENIED') {
      return;
    }
    const name = payload.event.employee.fullName;
    const code = payload.event.employee.employeeCode;
    await this.notifyRoles({
      companyId: payload.companyId,
      roles: [RoleCode.ADMIN, RoleCode.SUPERVISOR, RoleCode.GUARD],
      type: 'ACCESS_DENIED',
      title: 'Access denied',
      body: `${name} (${code}) was denied at ${payload.event.accessPointCode}`,
      payload: {
        attemptId: payload.event.id,
        employeeId: payload.event.employee.id,
        reasons: payload.event.reasons,
      },
    });
  }

  @OnEvent(SYSTEM_CAMERA_STATUS)
  async onCameraStatus(payload: CameraStatusPayload) {
    if (payload.status !== 'OFFLINE') return;
    await this.notifyRoles({
      companyId: payload.companyId,
      roles: [RoleCode.ADMIN, RoleCode.SUPERVISOR],
      type: 'CAMERA_OFFLINE',
      title: 'Camera offline',
      body: `Access point ${payload.accessPointCode} reported offline`,
      payload: {
        accessPointCode: payload.accessPointCode,
        lastHeartbeatAt: payload.lastHeartbeatAt,
      },
    });
  }
}
