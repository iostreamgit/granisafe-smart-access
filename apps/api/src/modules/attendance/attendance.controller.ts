import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { API_PREFIX, PermissionCode } from '@granisafe/shared';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import type { AuthUser } from '../../shared/security/auth-user';
import { RequireAnyPermissions } from '../../shared/security/permissions.decorator';
import { PermissionsGuard } from '../../shared/security/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AttendanceService } from './attendance.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';

const ATTENDANCE_VIEW = [
  PermissionCode.ATTENDANCE_VIEW_SELF,
  PermissionCode.ATTENDANCE_VIEW_TEAM,
  PermissionCode.ATTENDANCE_VIEW_ALL,
] as const;

@Controller(`${API_PREFIX.replace(/^\//, '')}/attendance`)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @RequireAnyPermissions(...ATTENDANCE_VIEW)
  list(@CurrentUser() user: AuthUser, @Query() query: AttendanceQueryDto) {
    return this.attendanceService.list(user, query);
  }

  @Get('current-on-site')
  @RequireAnyPermissions(...ATTENDANCE_VIEW)
  currentOnSite(@CurrentUser() user: AuthUser) {
    return this.attendanceService.currentOnSite(user);
  }

  @Get(':id')
  @RequireAnyPermissions(...ATTENDANCE_VIEW)
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.attendanceService.getById(user, id);
  }
}
