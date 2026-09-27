import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../shared/audit/audit.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthUser } from '../../shared/security/auth-user';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(actor: AuthUser) {
    return this.prisma.department.findMany({
      where: { companyId: actor.companyId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: { where: { deletedAt: null } } } } },
    });
  }

  async create(actor: AuthUser, dto: CreateDepartmentDto) {
    const code = dto.code.toUpperCase();
    const existing = await this.prisma.department.findFirst({
      where: { companyId: actor.companyId, code, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException({
        code: 'DEPARTMENT_CODE_EXISTS',
        title: 'Conflict',
        detail: `Department code ${code} already exists`,
      });
    }

    const department = await this.prisma.department.create({
      data: {
        companyId: actor.companyId,
        name: dto.name.trim(),
        code,
      },
    });

    await this.audit.write({
      companyId: actor.companyId,
      actorUserId: actor.id,
      action: 'DEPARTMENT_CREATED',
      entityType: 'department',
      entityId: department.id,
      metadata: { code, name: department.name },
    });

    return department;
  }

  async update(actor: AuthUser, id: string, dto: UpdateDepartmentDto) {
    const department = await this.requireDepartment(actor.companyId, id);

    if (dto.code) {
      const code = dto.code.toUpperCase();
      const clash = await this.prisma.department.findFirst({
        where: {
          companyId: actor.companyId,
          code,
          deletedAt: null,
          NOT: { id },
        },
      });
      if (clash) {
        throw new ConflictException({
          code: 'DEPARTMENT_CODE_EXISTS',
          title: 'Conflict',
          detail: `Department code ${code} already exists`,
        });
      }
    }

    const updated = await this.prisma.department.update({
      where: { id: department.id },
      data: {
        name: dto.name?.trim(),
        code: dto.code?.toUpperCase(),
      },
    });

    await this.audit.write({
      companyId: actor.companyId,
      actorUserId: actor.id,
      action: 'DEPARTMENT_UPDATED',
      entityType: 'department',
      entityId: id,
      metadata: { ...dto },
    });

    return updated;
  }

  async softDelete(actor: AuthUser, id: string) {
    await this.requireDepartment(actor.companyId, id);
    const deleted = await this.prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.write({
      companyId: actor.companyId,
      actorUserId: actor.id,
      action: 'DEPARTMENT_DELETED',
      entityType: 'department',
      entityId: id,
    });

    return deleted;
  }

  private async requireDepartment(companyId: string, id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!department) {
      throw new NotFoundException({
        code: 'DEPARTMENT_NOT_FOUND',
        title: 'Not found',
        detail: 'Department not found',
      });
    }
    return department;
  }
}
