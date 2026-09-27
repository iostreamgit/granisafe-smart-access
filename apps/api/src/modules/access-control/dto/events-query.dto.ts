import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { AccessAttemptStatus } from '@granisafe/shared';

export class AccessEventsQueryDto {
  @IsOptional()
  from?: string;

  @IsOptional()
  to?: string;

  @IsOptional()
  @IsIn(Object.values(AccessAttemptStatus))
  status?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

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
