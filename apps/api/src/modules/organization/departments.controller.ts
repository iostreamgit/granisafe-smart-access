import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@Controller(`${API_PREFIX.replace(/^\//, '')}/departments`)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @RequirePermissions(PermissionCode.EMPLOYEES_VIEW)
  list(@CurrentUser() user: AuthUser) {
    return this.departmentsService.list(user);
  }

  @Post()
  @RequirePermissions(PermissionCode.DEPARTMENTS_MANAGE)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(PermissionCode.DEPARTMENTS_MANAGE)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PermissionCode.DEPARTMENTS_MANAGE)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.departmentsService.softDelete(user, id);
  }
}
