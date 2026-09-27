import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ROLE_PERMISSIONS } from '@granisafe/shared';
import * as argon2 from 'argon2';
import { AuditService } from '../../shared/audit/audit.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthUser } from '../../shared/security/auth-user';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser) {
    const users = await this.prisma.user.findMany({
      where: { companyId: actor.companyId, deletedAt: null },
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return users.map((u) => this.toPublic(u));
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { companyId: actor.companyId, email },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException({
        code: 'EMAIL_EXISTS',
        title: 'Conflict',
        detail: 'A user with this email already exists',
      });
    }

    const role = await this.prisma.role.findUnique({ where: { code: dto.role } });
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        title: 'Not found',
        detail: `Role ${dto.role} not found`,
      });
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const user = await this.prisma.user.create({
      data: {
        companyId: actor.companyId,
        email,
        fullName: dto.fullName,
        passwordHash,
        roles: { create: { roleId: role.id } },
      },
      include: { roles: { include: { role: true } } },
    });

    await this.audit.write({
      companyId: actor.companyId,
      actorUserId: actor.id,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: user.id,
      metadata: { email, role: dto.role },
    });

    return this.toPublic(user);
  }

  async update(actor: AuthUser, id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId: actor.companyId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        title: 'Not found',
        detail: 'User not found',
      });
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        isActive: dto.isActive,
      },
      include: { roles: { include: { role: true } } },
    });

    await this.audit.write({
      companyId: actor.companyId,
      actorUserId: actor.id,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: id,
      metadata: { ...dto },
    });

    return this.toPublic(updated);
  }

  async assignRole(actor: AuthUser, id: string, dto: AssignRoleDto) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId: actor.companyId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        title: 'Not found',
        detail: 'User not found',
      });
    }

    const role = await this.prisma.role.findUnique({ where: { code: dto.role } });
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        title: 'Not found',
        detail: `Role ${dto.role} not found`,
      });
    }

    await this.prisma.userRole.deleteMany({ where: { userId: id } });
    await this.prisma.userRole.create({ data: { userId: id, roleId: role.id } });

    const updated = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { roles: { include: { role: true } } },
    });

    await this.audit.write({
      companyId: actor.companyId,
      actorUserId: actor.id,
      action: 'USER_ROLE_ASSIGNED',
      entityType: 'user',
      entityId: id,
      metadata: { role: dto.role },
    });

    return this.toPublic(updated);
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { code: 'asc' },
    });

    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      permissions:
        role.permissions.length > 0
          ? role.permissions.map((rp) => rp.permission.code)
          : (ROLE_PERMISSIONS[role.code] ?? []),
    }));
  }

  private toPublic(user: {
    id: string;
    email: string;
    fullName: string;
    companyId: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    roles: Array<{ role: { code: string; name: string } }>;
  }) {
    const roles = user.roles.map((ur) => ur.role.code);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      companyId: user.companyId,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles,
      permissions: Array.from(new Set(roles.flatMap((r) => ROLE_PERMISSIONS[r] ?? []))),
    };
  }
}
