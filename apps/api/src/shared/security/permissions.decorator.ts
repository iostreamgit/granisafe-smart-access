import { applyDecorators, SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const PERMISSIONS_MODE_KEY = 'permissions_mode';

export type PermissionsMode = 'all' | 'any';

export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** User needs at least one of the listed permissions. */
export const RequireAnyPermissions = (...permissions: string[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    SetMetadata(PERMISSIONS_MODE_KEY, 'any' satisfies PermissionsMode),
  );
