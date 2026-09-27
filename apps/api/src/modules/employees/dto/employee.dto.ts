import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { EmployeeStatus } from '@granisafe/shared';

export class CreateEmployeeDto {
  @IsString()
  @Matches(/^[A-Z0-9_-]{2,32}$/i)
  employeeCode!: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  shiftStart?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  lateGraceMinutes?: number;

  @IsOptional()
  @IsString()
  @MinLength(4)
  rfidTag?: string;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  shiftStart?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  lateGraceMinutes?: number;

  @IsOptional()
  @IsIn(Object.values(EmployeeStatus))
  status?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  rfidTag?: string | null;
}
