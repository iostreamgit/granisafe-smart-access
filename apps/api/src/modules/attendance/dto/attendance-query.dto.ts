import { Type } from 'class-transformer';
import { IsBooleanString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PunchType } from '@granisafe/shared';

export class AttendanceQueryDto {
  @IsOptional()
  from?: string;

  @IsOptional()
  to?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsIn(Object.values(PunchType))
  punchType?: string;

  @IsOptional()
  @IsBooleanString()
  lateOnly?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
