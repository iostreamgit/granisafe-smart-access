import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { API_PREFIX, PermissionCode } from '@granisafe/shared';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import type { AuthUser } from '../../shared/security/auth-user';
import { RequirePermissions } from '../../shared/security/permissions.decorator';
import { PermissionsGuard } from '../../shared/security/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller(`${API_PREFIX.replace(/^\//, '')}`)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users')
  @RequirePermissions(PermissionCode.USERS_MANAGE)
  list(@CurrentUser() user: AuthUser) {
    return this.usersService.list(user);
  }

  @Post('users')
  @RequirePermissions(PermissionCode.USERS_MANAGE)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user, dto);
  }

  @Patch('users/:id')
  @RequirePermissions(PermissionCode.USERS_MANAGE)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user, id, dto);
  }

  @Post('users/:id/roles')
  @RequirePermissions(PermissionCode.USERS_MANAGE)
  assignRole(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usersService.assignRole(user, id, dto);
  }

  @Get('roles')
  @RequirePermissions(PermissionCode.USERS_MANAGE)
  roles() {
    return this.usersService.listRoles();
  }
}
