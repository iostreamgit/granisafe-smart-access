import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { API_PREFIX, PermissionCode } from '@granisafe/shared';
import type { Request } from 'express';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import type { AuthUser } from '../../shared/security/auth-user';
import { RequirePermissions } from '../../shared/security/permissions.decorator';
import { PermissionsGuard } from '../../shared/security/permissions.guard';
import { AuthService } from './auth.service';
import { BootstrapDto } from './dto/bootstrap.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller(`${API_PREFIX.replace(/^\//, '')}/auth`)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthUser, @Body() dto: LogoutDto) {
    await this.authService.logout(dto.refreshToken, user.id);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(user, dto);
  }

  @Post('bootstrap')
  @HttpCode(HttpStatus.CREATED)
  bootstrap(@Body() dto: BootstrapDto) {
    return this.authService.bootstrap(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  /** Smoke endpoint for RBAC 403 demos (Admin/users.manage only). */
  @Get('admin-check')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PermissionCode.USERS_MANAGE)
  adminCheck(@CurrentUser() user: AuthUser) {
    return { ok: true, userId: user.id, roles: user.roles };
  }
}
