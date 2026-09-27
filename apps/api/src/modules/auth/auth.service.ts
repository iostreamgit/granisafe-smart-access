import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RoleCode, ROLE_PERMISSIONS } from '@granisafe/shared';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../../shared/audit/audit.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthUser } from '../../shared/security/auth-user';
import { BootstrapDto } from './dto/bootstrap.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

type UserWithRoles = {
  id: string;
  email: string;
  fullName: string;
  companyId: string;
  passwordHash: string;
  isActive: boolean;
  deletedAt: Date | null;
  roles: Array<{ role: { code: string } }>;
};

@Injectable()
export class AuthService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.accessTtlSeconds = Number(this.config.get('JWT_ACCESS_TTL_SECONDS') ?? 900);
    this.refreshTtlDays = Number(this.config.get('JWT_REFRESH_TTL_DAYS') ?? 7);
  }

  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email.toLowerCase(),
        deletedAt: null,
      },
      include: { roles: { include: { role: true } } },
    });

    if (!user || !user.isActive) {
      await this.audit.write({
        action: 'LOGIN_FAILED',
        entityType: 'user',
        metadata: { email: dto.email.toLowerCase(), reason: 'INVALID_OR_INACTIVE' },
        ipAddress,
      });
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        title: 'Unauthorized',
        detail: 'Invalid email or password',
      });
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      await this.audit.write({
        companyId: user.companyId,
        actorUserId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'user',
        entityId: user.id,
        metadata: { reason: 'BAD_PASSWORD' },
        ipAddress,
      });
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        title: 'Unauthorized',
        detail: 'Invalid email or password',
      });
    }

    const authUser = this.toAuthUser(user);
    const tokens = await this.issueTokens(user.id);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.write({
      companyId: user.companyId,
      actorUserId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'user',
      entityId: user.id,
      ipAddress,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: this.accessTtlSeconds,
      user: authUser,
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { include: { roles: { include: { role: true } } } },
      },
    });

    if (!stored || !stored.user.isActive || stored.user.deletedAt) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        title: 'Unauthorized',
        detail: 'Refresh token is invalid or expired',
      });
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(stored.user.id);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: this.accessTtlSeconds,
      user: this.toAuthUser(stored.user),
    };
  }

  async logout(refreshToken?: string, userId?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else if (userId) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    if (userId) {
      await this.audit.write({
        actorUserId: userId,
        action: 'LOGOUT',
        entityType: 'user',
        entityId: userId,
      });
    }
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto) {
    const dbUser = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const valid = await argon2.verify(dbUser.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        title: 'Unauthorized',
        detail: 'Current password is incorrect',
      });
    }

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.write({
      companyId: user.companyId,
      actorUserId: user.id,
      action: 'PASSWORD_CHANGED',
      entityType: 'user',
      entityId: user.id,
    });
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null, isActive: true },
      include: { roles: { include: { role: true } } },
    });
    return this.toAuthUser(user);
  }

  async bootstrap(dto: BootstrapDto) {
    const existingUsers = await this.prisma.user.count();
    if (existingUsers > 0) {
      throw new ConflictException({
        code: 'BOOTSTRAP_LOCKED',
        title: 'Conflict',
        detail: 'Bootstrap is only allowed on an empty database. Use seed or admin APIs.',
      });
    }

    const slug =
      dto.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || 'company';

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const company = await this.prisma.company.create({
      data: { name: dto.companyName, slug: `${slug}-${randomBytes(2).toString('hex')}` },
    });

    // Ensure ADMIN role + full permission set exist (minimal bootstrap path).
    for (const [code, description] of Object.entries(
      Object.fromEntries(Object.values(ROLE_PERMISSIONS.ADMIN).map((c) => [c, c])),
    )) {
      await this.prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description },
      });
    }

    const adminRole = await this.prisma.role.upsert({
      where: { code: RoleCode.ADMIN },
      update: {},
      create: { code: RoleCode.ADMIN, name: 'Administrator' },
    });

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: ROLE_PERMISSIONS.ADMIN } },
    });
    await this.prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
      skipDuplicates: true,
    });

    const user = await this.prisma.user.create({
      data: {
        companyId: company.id,
        email: dto.email.toLowerCase(),
        fullName: dto.fullName,
        passwordHash,
        roles: { create: { roleId: adminRole.id } },
      },
      include: { roles: { include: { role: true } } },
    });

    await this.audit.write({
      companyId: company.id,
      actorUserId: user.id,
      action: 'BOOTSTRAP_ADMIN',
      entityType: 'user',
      entityId: user.id,
    });

    const tokens = await this.issueTokens(user.id);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: this.accessTtlSeconds,
      user: this.toAuthUser(user),
    };
  }

  private async issueTokens(userId: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.accessTtlSeconds,
      },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTtlDays);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private toAuthUser(user: UserWithRoles): AuthUser {
    const roles = user.roles.map((ur) => ur.role.code);
    const permissions = Array.from(new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? [])));
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      companyId: user.companyId,
      roles,
      permissions,
    };
  }
}
