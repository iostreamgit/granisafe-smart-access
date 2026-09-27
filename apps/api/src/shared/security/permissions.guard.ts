import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from './auth-user';
import {
  PERMISSIONS_KEY,
  PERMISSIONS_MODE_KEY,
  type PermissionsMode,
} from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const mode =
      this.reflector.getAllAndOverride<PermissionsMode>(PERMISSIONS_MODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'all';

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        title: 'Forbidden',
        detail: 'Authentication required',
      });
    }

    const allowed =
      mode === 'any'
        ? required.some((permission) => user.permissions.includes(permission))
        : required.every((permission) => user.permissions.includes(permission));

    if (!allowed) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        title: 'Forbidden',
        detail: `Missing permission: ${required.join(', ')}`,
      });
    }

    return true;
  }
}
