import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmployeeStatus, IdentifierType } from '@granisafe/shared';
import { AuditService } from '../../shared/audit/audit.service';
import {
  createQrPayload,
  displayHint,
  hashIdentifier,
  qrDataUrl,
} from '../../shared/identifiers/identifier.util';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthUser } from '../../shared/security/auth-user';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    actor: AuthUser,
    filters: {
      search?: string;
      departmentId?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const take = Math.min(Math.max(filters.pageSize ?? 20, 1), 100);
    const skip = (Math.max(filters.page ?? 1, 1) - 1) * take;

    const where = {
      companyId: actor.companyId,
      deletedAt: null,
      departmentId: filters.departmentId || undefined,
      status: filters.status || undefined,
      OR: filters.search
        ? [
            { firstName: { contains: filters.search, mode: 'insensitive' as const } },
            { lastName: { contains: filters.search, mode: 'insensitive' as const } },
            { employeeCode: { contains: filters.search, mode: 'insensitive' as const } },
          ]
        : undefined,
    };

    const [total, employees] = await Promise.all([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        include: {
          department: true,
          identifiers: { where: { isActive: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take,
      }),
    ]);

    return {
      data: employees.map((e) => this.toPublic(e)),
      meta: {
        page: Math.floor(skip / take) + 1,
        pageSize: take,
        total,
      },
    };
  }

  async getById(actor: AuthUser, id: string) {
    const employee = await this.requireEmployee(actor.companyId, id);
    return this.toPublic(employee);
  }

  async create(actor: AuthUser, dto: CreateEmployeeDto) {
    const employeeCode = dto.employeeCode.toUpperCase();
    await this.ensureUniqueCode(actor.companyId, employeeCode);
    if (dto.departmentId) {
      await this.ensureDepartment(actor.companyId, dto.departmentId);
    }
    if (dto.rfidTag) {
      await this.ensureUniqueIdentifier(IdentifierType.RFID, dto.rfidTag);
    }

    const qrPayload = createQrPayload();
    const employee = await this.prisma.employee.create({
      data: {
        companyId: actor.companyId,
        employeeCode,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        departmentId: dto.departmentId,
        shiftStart: this.normalizeShift(dto.shiftStart) ?? '08:00:00',
        lateGraceMinutes: dto.lateGraceMinutes ?? 10,
        status: EmployeeStatus.ACTIVE,
        identifiers: {
          create: [
            {
              type: IdentifierType.QR,
              value: qrPayload,
              valueHash: hashIdentifier(qrPayload),
              displayHint: displayHint(qrPayload),
              isActive: true,
            },
            ...(dto.rfidTag
              ? [
                  {
                    type: IdentifierType.RFID,
                    value: dto.rfidTag.trim(),
                    valueHash: hashIdentifier(dto.rfidTag.trim()),
                    displayHint: displayHint(dto.rfidTag.trim()),
                    isActive: true,
                  },
                ]
              : []),
          ],
        },
      },
      include: { department: true, identifiers: { where: { isActive: true } } },
    });

    await this.audit.write({
      companyId: actor.companyId,
      actorUserId: actor.id,
      action: 'EMPLOYEE_CREATED',
      entityType: 'employee',
      entityId: employee.id,
      metadata: { employeeCode },
    });

    const qrImageDataUrl = await qrDataUrl(qrPayload);
    return {
      ...this.toPublic(employee),
      qr: {
        employeeId: employee.id,
        qrPayload,
        qrImageDataUrl,
        rotatedAt: new Date().toISOString(),
      },
    };
  }

  async update(actor: AuthUser, id: string, dto: UpdateEmployeeDto) {
    await this.requireEmployee(actor.companyId, id);

    if (dto.departmentId) {
      await this.ensureDepartment(actor.companyId, dto.departmentId);
    }

    if (dto.rfidTag !== undefined) {
      await this.prisma.employeeIdentifier.updateMany({
        where: { employeeId: id, type: IdentifierType.RFID, isActive: true },
        data: { isActive: false, rotatedAt: new Date() },
      });

      if (dto.rfidTag) {
        await this.ensureUniqueIdentifier(IdentifierType.RFID, dto.rfidTag, id);
        await this.prisma.employeeIdentifier.create({
          data: {
            employeeId: id,
            type: IdentifierType.RFID,
            value: dto.rfidTag.trim(),
            valueHash: hashIdentifier(dto.rfidTag.trim()),
            displayHint: displayHint(dto.rfidTag.trim()),
            isActive: true,
          },
        });
      }
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        departmentId: dto.departmentId === undefined ? undefined : dto.departmentId,
        shiftStart: dto.shiftStart === undefined ? undefined : this.normalizeShift(dto.shiftStart),
        lateGraceMinutes: dto.lateGraceMinutes,
        status: dto.status,
      },
      include: { department: true, identifiers: { where: { isActive: true } } },
    });

    await this.audit.write({
      companyId: actor.companyId,
      actorUserId: actor.id,
      action: 'EMPLOYEE_UPDATED',
      entityType: 'employee',
      entityId: id,
      metadata: { ...dto, rfidTag: dto.rfidTag ? '[set]' : dto.rfidTag },
    });

    return this.toPublic(updated);
  }

  async deactivate(actor: AuthUser, id: string) {
    await this.requireEmployee(actor.companyId, id);
    const updated = await this.prisma.employee.update({
      where: { id },
      data: { status: EmployeeStatus.INACTIVE },
      include: { department: true, identifiers: { where: { isActive: true } } },
    });

    await this.audit.write({
      companyId: actor.companyId,
      actorUserId: actor.id,
      action: 'EMPLOYEE_DEACTIVATED',
      entityType: 'employee',
      entityId: id,
    });

    return this.toPublic(updated);
  }

  async softDelete(actor: AuthUser, id: string) {
    await this.requireEmployee(actor.companyId, id);
    await this.prisma.employee.update({
      where: { id },
      data: {
        status: EmployeeStatus.INACTIVE,
        deletedAt: new Date(),
      },
    });
    await this.prisma.employeeIdentifier.updateMany({
      where: { employeeId: id, isActive: true },
      data: { isActive: false, rotatedAt: new Date() },
    });

    await this.audit.write({
      companyId: actor.companyId,
      actorUserId: actor.id,
      action: 'EMPLOYEE_DELETED',
      entityType: 'employee',
      entityId: id,
    });
  }

  async getQr(actor: AuthUser, id: string) {
    const employee = await this.requireEmployee(actor.companyId, id);
    const qr = employee.identifiers.find((i) => i.type === IdentifierType.QR && i.isActive);
    if (!qr) {
      throw new NotFoundException({
        code: 'QR_NOT_FOUND',
        title: 'Not found',
        detail: 'No active QR for this employee',
      });
    }

    return {
      employeeId: employee.id,
      qrPayload: qr.value,
      qrImageDataUrl: await qrDataUrl(qr.value),
      rotatedAt: (qr.rotatedAt ?? qr.createdAt).toISOString(),
      displayHint: qr.displayHint,
    };
  }

  async regenerateQr(actor: AuthUser, id: string) {
    await this.requireEmployee(actor.companyId, id);

    await this.prisma.employeeIdentifier.updateMany({
      where: { employeeId: id, type: IdentifierType.QR, isActive: true },
      data: { isActive: false, rotatedAt: new Date() },
    });

    const qrPayload = createQrPayload();
    const created = await this.prisma.employeeIdentifier.create({
      data: {
        employeeId: id,
        type: IdentifierType.QR,
        value: qrPayload,
        valueHash: hashIdentifier(qrPayload),
        displayHint: displayHint(qrPayload),
        isActive: true,
        rotatedAt: new Date(),
      },
    });

    await this.audit.write({
      companyId: actor.companyId,
      actorUserId: actor.id,
      action: 'EMPLOYEE_QR_REGENERATED',
      entityType: 'employee',
      entityId: id,
    });

    return {
      employeeId: id,
      qrPayload,
      qrImageDataUrl: await qrDataUrl(qrPayload),
      rotatedAt: (created.rotatedAt ?? created.createdAt).toISOString(),
      displayHint: created.displayHint,
    };
  }

  private async requireEmployee(companyId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        department: true,
        identifiers: true,
      },
    });
    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        title: 'Not found',
        detail: 'Employee not found',
      });
    }
    return employee;
  }

  private async ensureUniqueCode(companyId: string, employeeCode: string) {
    const existing = await this.prisma.employee.findFirst({
      where: { companyId, employeeCode, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException({
        code: 'EMPLOYEE_CODE_EXISTS',
        title: 'Conflict',
        detail: `Employee code ${employeeCode} already exists`,
      });
    }
  }

  private async ensureDepartment(companyId: string, departmentId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, companyId, deletedAt: null },
    });
    if (!department) {
      throw new NotFoundException({
        code: 'DEPARTMENT_NOT_FOUND',
        title: 'Not found',
        detail: 'Department not found',
      });
    }
  }

  private async ensureUniqueIdentifier(type: string, value: string, excludeEmployeeId?: string) {
    const valueHash = hashIdentifier(value.trim());
    const existing = await this.prisma.employeeIdentifier.findFirst({
      where: {
        type,
        valueHash,
        isActive: true,
        ...(excludeEmployeeId ? { employeeId: { not: excludeEmployeeId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException({
        code: 'IDENTIFIER_EXISTS',
        title: 'Conflict',
        detail: `${type} identifier is already assigned`,
      });
    }
  }

  private normalizeShift(value?: string | null) {
    if (value === null) return null;
    if (!value) return undefined;
    return value.length === 5 ? `${value}:00` : value;
  }

  private toPublic(employee: {
    id: string;
    companyId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    status: string;
    shiftStart: string | null;
    lateGraceMinutes: number;
    departmentId: string | null;
    createdAt: Date;
    updatedAt: Date;
    department: { id: string; name: string; code: string } | null;
    identifiers: Array<{
      type: string;
      displayHint: string;
      isActive: boolean;
    }>;
  }) {
    const activeIds = employee.identifiers.filter((i) => i.isActive);
    return {
      id: employee.id,
      companyId: employee.companyId,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      fullName: `${employee.firstName} ${employee.lastName}`,
      status: employee.status,
      shiftStart: employee.shiftStart,
      lateGraceMinutes: employee.lateGraceMinutes,
      departmentId: employee.departmentId,
      department: employee.department
        ? {
            id: employee.department.id,
            name: employee.department.name,
            code: employee.department.code,
          }
        : null,
      hasQr: activeIds.some((i) => i.type === IdentifierType.QR),
      qrHint: activeIds.find((i) => i.type === IdentifierType.QR)?.displayHint ?? null,
      rfidHint: activeIds.find((i) => i.type === IdentifierType.RFID)?.displayHint ?? null,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }
}
