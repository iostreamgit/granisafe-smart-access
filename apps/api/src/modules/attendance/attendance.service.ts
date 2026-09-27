import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PermissionCode, PunchType } from '@granisafe/shared';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../../shared/security/auth-user';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AttendanceQueryDto } from './dto/attendance-query.dto';

type Scope = {
  mode: 'all' | 'team' | 'self';
  employeeId?: string;
  departmentId?: string;
};

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthUser, query: AttendanceQueryDto) {
    const scope = await this.resolveScope(actor);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where = this.buildWhere(actor.companyId, scope, query);

    const [total, rows] = await Promise.all([
      this.prisma.attendanceRecord.count({ where }),
      this.prisma.attendanceRecord.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              departmentId: true,
              department: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: { punchedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => this.toPublic(row)),
      page,
      pageSize,
      total,
    };
  }

  async getById(actor: AuthUser, id: string) {
    const scope = await this.resolveScope(actor);
    const row = await this.prisma.attendanceRecord.findFirst({
      where: { id, companyId: actor.companyId },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            departmentId: true,
            department: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    if (!row) {
      throw new NotFoundException({
        code: 'ATTENDANCE_NOT_FOUND',
        title: 'Not Found',
        detail: 'Attendance record not found',
      });
    }

    this.assertReadable(scope, row.employeeId, row.employee.departmentId);
    return this.toPublic(row);
  }

  async currentOnSite(actor: AuthUser) {
    const scope = await this.resolveScope(actor);
    const employeeFilter = this.employeeScopeFilter(scope);

    const employees = await this.prisma.employee.findMany({
      where: {
        companyId: actor.companyId,
        deletedAt: null,
        ...employeeFilter,
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        departmentId: true,
        department: { select: { id: true, code: true, name: true } },
        attendanceRecords: {
          orderBy: { punchedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            punchType: true,
            punchedAt: true,
            isLate: true,
            source: true,
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const onSite = employees
      .filter((emp) => emp.attendanceRecords[0]?.punchType === PunchType.ENTRY)
      .map((emp) => {
        const last = emp.attendanceRecords[0]!;
        return {
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          firstName: emp.firstName,
          lastName: emp.lastName,
          department: emp.department,
          lastEntry: {
            id: last.id,
            punchedAt: last.punchedAt.toISOString(),
            isLate: last.isLate,
            source: last.source,
          },
        };
      });

    return { count: onSite.length, items: onSite };
  }

  private async resolveScope(actor: AuthUser): Promise<Scope> {
    const perms = new Set(actor.permissions);
    if (perms.has(PermissionCode.ATTENDANCE_VIEW_ALL)) {
      return { mode: 'all' };
    }

    const linked = await this.prisma.employee.findFirst({
      where: { companyId: actor.companyId, userId: actor.id, deletedAt: null },
      select: { id: true, departmentId: true },
    });

    if (perms.has(PermissionCode.ATTENDANCE_VIEW_TEAM)) {
      return {
        mode: 'team',
        employeeId: linked?.id,
        departmentId: linked?.departmentId ?? undefined,
      };
    }

    if (perms.has(PermissionCode.ATTENDANCE_VIEW_SELF)) {
      return { mode: 'self', employeeId: linked?.id };
    }

    throw new ForbiddenException({
      code: 'FORBIDDEN',
      title: 'Forbidden',
      detail: 'Missing attendance view permission',
    });
  }

  private buildWhere(
    companyId: string,
    scope: Scope,
    query: AttendanceQueryDto,
  ): Prisma.AttendanceRecordWhereInput {
    const where: Prisma.AttendanceRecordWhereInput = { companyId };

    if (scope.mode === 'self') {
      where.employeeId = scope.employeeId ?? '__none__';
    } else if (scope.mode === 'team') {
      if (scope.departmentId) {
        where.employee = { departmentId: scope.departmentId, deletedAt: null };
      } else {
        where.employeeId = scope.employeeId ?? '__none__';
      }
    }

    if (query.employeeId) {
      if (scope.mode === 'self' && query.employeeId !== scope.employeeId) {
        where.employeeId = '__none__';
      } else {
        where.employeeId = query.employeeId;
      }
    }

    if (query.departmentId && scope.mode !== 'self') {
      // Department filter wins over a looser team department scope when both apply.
      where.employee = { departmentId: query.departmentId, deletedAt: null };
    }

    if (query.punchType) where.punchType = query.punchType;
    if (query.lateOnly === 'true') where.isLate = true;

    if (query.from || query.to) {
      where.punchedAt = {};
      if (query.from) {
        const from = new Date(query.from);
        if (!Number.isNaN(from.getTime())) where.punchedAt.gte = from;
      }
      if (query.to) {
        const to = new Date(query.to);
        if (!Number.isNaN(to.getTime())) where.punchedAt.lte = to;
      }
    }

    return where;
  }

  private employeeScopeFilter(scope: Scope): Prisma.EmployeeWhereInput {
    if (scope.mode === 'self') {
      return { id: scope.employeeId ?? '__none__' };
    }
    if (scope.mode === 'team') {
      if (scope.departmentId) return { departmentId: scope.departmentId };
      return { id: scope.employeeId ?? '__none__' };
    }
    return {};
  }

  private assertReadable(scope: Scope, employeeId: string, departmentId: string | null) {
    if (scope.mode === 'all') return;
    if (scope.mode === 'self' && scope.employeeId === employeeId) return;
    if (
      scope.mode === 'team' &&
      ((scope.departmentId && departmentId === scope.departmentId) ||
        scope.employeeId === employeeId)
    ) {
      return;
    }
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      title: 'Forbidden',
      detail: 'Not allowed to view this attendance record',
    });
  }

  private toPublic(row: {
    id: string;
    companyId: string;
    employeeId: string;
    accessAttemptId: string | null;
    punchType: string;
    punchedAt: Date;
    isLate: boolean;
    source: string;
    employee: {
      id: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
      departmentId: string | null;
      department: { id: string; code: string; name: string } | null;
    };
  }) {
    return {
      id: row.id,
      companyId: row.companyId,
      employeeId: row.employeeId,
      accessAttemptId: row.accessAttemptId,
      punchType: row.punchType,
      punchedAt: row.punchedAt.toISOString(),
      isLate: row.isLate,
      source: row.source,
      employee: {
        id: row.employee.id,
        employeeCode: row.employee.employeeCode,
        firstName: row.employee.firstName,
        lastName: row.employee.lastName,
        department: row.employee.department,
      },
    };
  }
}
