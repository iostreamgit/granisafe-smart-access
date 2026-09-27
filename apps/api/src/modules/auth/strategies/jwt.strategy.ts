import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ROLE_PERMISSIONS } from '@granisafe/shared';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { AuthUser } from '../../../shared/security/auth-user';

type JwtPayload = {
  sub: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null, isActive: true },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        title: 'Unauthorized',
        detail: 'User not found or inactive',
      });
    }

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
