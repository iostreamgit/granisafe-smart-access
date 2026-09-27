import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { API_PREFIX, PermissionCode } from '@granisafe/shared';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import type { AuthUser } from '../../shared/security/auth-user';
import { RequirePermissions } from '../../shared/security/permissions.decorator';
import { PermissionsGuard } from '../../shared/security/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Controller(`${API_PREFIX.replace(/^\//, '')}/settings`)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermissions(PermissionCode.SETTINGS_MANAGE)
  get(@CurrentUser() user: AuthUser) {
    return this.settings.getView(user.companyId);
  }

  @Put()
  @RequirePermissions(PermissionCode.SETTINGS_MANAGE)
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    return this.settings.update(user, dto);
  }
}
