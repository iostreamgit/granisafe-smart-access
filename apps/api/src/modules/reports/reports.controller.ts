import { Body, Controller, Get, HttpCode, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { API_PREFIX, PermissionCode } from '@granisafe/shared';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import type { AuthUser } from '../../shared/security/auth-user';
import { RequirePermissions } from '../../shared/security/permissions.decorator';
import { PermissionsGuard } from '../../shared/security/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';

@Controller(`${API_PREFIX.replace(/^\//, '')}/reports`)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('attendance')
  @HttpCode(202)
  @RequirePermissions(PermissionCode.REPORTS_EXPORT)
  attendance(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.reports.enqueue(user, 'ATTENDANCE', dto);
  }

  @Post('rejections')
  @HttpCode(202)
  @RequirePermissions(PermissionCode.REPORTS_EXPORT)
  rejections(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.reports.enqueue(user, 'REJECTIONS', dto);
  }

  @Post('ppe-compliance')
  @HttpCode(202)
  @RequirePermissions(PermissionCode.REPORTS_EXPORT)
  ppeCompliance(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.reports.enqueue(user, 'PPE_COMPLIANCE', dto);
  }

  @Get(':jobId')
  @RequirePermissions(PermissionCode.REPORTS_VIEW)
  getJob(@CurrentUser() user: AuthUser, @Param('jobId') jobId: string) {
    return this.reports.getJob(user, jobId);
  }

  @Get(':jobId/download')
  @RequirePermissions(PermissionCode.REPORTS_VIEW)
  async download(
    @CurrentUser() user: AuthUser,
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ) {
    const file = await this.reports.download(user, jobId);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }
}
