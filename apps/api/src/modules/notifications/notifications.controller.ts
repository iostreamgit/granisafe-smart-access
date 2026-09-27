import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { API_PREFIX, PermissionCode } from '@granisafe/shared';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import type { AuthUser } from '../../shared/security/auth-user';
import { RequirePermissions } from '../../shared/security/permissions.decorator';
import { PermissionsGuard } from '../../shared/security/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller(`${API_PREFIX.replace(/^\//, '')}/notifications`)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions(PermissionCode.NOTIFICATIONS_VIEW)
  list(
    @CurrentUser() user: AuthUser,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('type') type?: string,
    @Query('isRead') isRead?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.notifications.list(user, {
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
      type,
      isRead,
      from,
      to,
    });
  }

  @Post('read-all')
  @RequirePermissions(PermissionCode.NOTIFICATIONS_VIEW)
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }

  @Post(':id/read')
  @RequirePermissions(PermissionCode.NOTIFICATIONS_VIEW)
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user, id);
  }
}
