import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { API_PREFIX, PermissionCode } from '@granisafe/shared';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import type { AuthUser } from '../../shared/security/auth-user';
import { RequirePermissions } from '../../shared/security/permissions.decorator';
import { PermissionsGuard } from '../../shared/security/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CameraHeartbeatDto } from './dto/camera-heartbeat.dto';
import { DashboardService } from './dashboard.service';

@Controller(`${API_PREFIX.replace(/^\//, '')}/dashboard`)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @RequirePermissions(PermissionCode.DASHBOARD_VIEW)
  summary(@CurrentUser() user: AuthUser) {
    return this.dashboard.summary(user);
  }

  @Post('camera-heartbeat')
  @RequirePermissions(PermissionCode.ACCESS_OPERATE)
  heartbeat(@CurrentUser() user: AuthUser, @Body() dto: CameraHeartbeatDto) {
    return this.dashboard.heartbeat(user, dto);
  }
}
