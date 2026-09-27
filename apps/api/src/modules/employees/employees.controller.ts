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
  Query,
  UseGuards,
} from '@nestjs/common';
import { API_PREFIX, PermissionCode } from '@granisafe/shared';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import type { AuthUser } from '../../shared/security/auth-user';
import { RequirePermissions } from '../../shared/security/permissions.decorator';
import { PermissionsGuard } from '../../shared/security/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { EmployeesService } from './employees.service';

@Controller(`${API_PREFIX.replace(/^\//, '')}/employees`)
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermissions(PermissionCode.EMPLOYEES_VIEW)
  list(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.employeesService.list(user, {
      search,
      departmentId,
      status,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
    });
  }

  @Get(':id')
  @RequirePermissions(PermissionCode.EMPLOYEES_VIEW)
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.getById(user, id);
  }

  @Post()
  @RequirePermissions(PermissionCode.EMPLOYEES_MANAGE)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(PermissionCode.EMPLOYEES_MANAGE)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(user, id, dto);
  }

  @Post(':id/deactivate')
  @RequirePermissions(PermissionCode.EMPLOYEES_MANAGE)
  deactivate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.deactivate(user, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PermissionCode.EMPLOYEES_MANAGE)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.employeesService.softDelete(user, id);
  }

  @Get(':id/qr')
  @RequirePermissions(PermissionCode.EMPLOYEES_MANAGE)
  getQr(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.getQr(user, id);
  }

  @Post(':id/qr/regenerate')
  @RequirePermissions(PermissionCode.EMPLOYEES_MANAGE)
  regenerateQr(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.regenerateQr(user, id);
  }
}
