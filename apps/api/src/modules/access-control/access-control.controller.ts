import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { API_PREFIX, PermissionCode } from '@granisafe/shared';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import type { AuthUser } from '../../shared/security/auth-user';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../shared/security/permissions.decorator';
import { PermissionsGuard } from '../../shared/security/permissions.guard';
import { inspectFrameMulterOptions } from '../../shared/upload/upload.limits';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessControlService } from './access-control.service';
import { AccessEventsQueryDto } from './dto/events-query.dto';
import { IdentifyDto } from './dto/identify.dto';

@Controller(`${API_PREFIX.replace(/^\//, '')}/access`)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccessControlController {
  constructor(private readonly accessControl: AccessControlService) {}

  @Get('ai-status')
  @RequireAnyPermissions(PermissionCode.ACCESS_OPERATE, PermissionCode.ACCESS_VIEW_EVENTS)
  aiStatus() {
    return this.accessControl.aiStatus();
  }

  @Post('identify')
  @RequirePermissions(PermissionCode.ACCESS_OPERATE)
  identify(@CurrentUser() user: AuthUser, @Body() dto: IdentifyDto) {
    return this.accessControl.identify(user, dto);
  }

  @Post('inspect')
  @RequirePermissions(PermissionCode.ACCESS_OPERATE)
  @UseInterceptors(
    FileInterceptor('frame', {
      storage: memoryStorage(),
      ...inspectFrameMulterOptions(),
    }),
  )
  inspect(
    @CurrentUser() user: AuthUser,
    @UploadedFile() frame: Express.Multer.File | undefined,
    @Body('attemptId') attemptId: string,
    @Body('mockScenario') mockScenario: string | undefined,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.accessControl.inspect(user, {
      attemptId,
      mockScenario,
      frame,
      idempotencyKey,
    });
  }

  @Get('events')
  @RequirePermissions(PermissionCode.ACCESS_VIEW_EVENTS)
  listEvents(@CurrentUser() user: AuthUser, @Query() query: AccessEventsQueryDto) {
    return this.accessControl.listEvents(user, query);
  }

  @Get('events/:id')
  @RequirePermissions(PermissionCode.ACCESS_VIEW_EVENTS)
  getEvent(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.accessControl.getEvent(user, id);
  }
}
