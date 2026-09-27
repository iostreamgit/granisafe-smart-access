import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { API_PREFIX, PermissionCode } from '@granisafe/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import type { AuthUser } from '../../shared/security/auth-user';
import { RequirePermissions } from '../../shared/security/permissions.decorator';
import { PermissionsGuard } from '../../shared/security/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller(`${API_PREFIX.replace(/^\//, '')}/audit-logs`)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions(PermissionCode.AUDIT_VIEW)
  async list(
    @CurrentUser() user: AuthUser,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('actorUserId') actorUserId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const take = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const createdAt: Prisma.DateTimeFilter = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) createdAt.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        createdAt.lte = d;
      }
    }

    const where: Prisma.AuditLogWhereInput = {
      companyId: user.companyId,
      ...(actorUserId ? { actorUserId } : {}),
      ...(action?.trim() ? { action: { contains: action.trim(), mode: 'insensitive' } } : {}),
      ...(entityType?.trim()
        ? { entityType: { contains: entityType.trim(), mode: 'insensitive' } }
        : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          actor: { select: { id: true, email: true, fullName: true } },
        },
      }),
    ]);

    return {
      data,
      meta: { page: Math.floor(skip / take) + 1, pageSize: take, total },
    };
  }
}
