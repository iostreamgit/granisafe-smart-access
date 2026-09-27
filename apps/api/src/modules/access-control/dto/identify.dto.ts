import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccessDirection, AccessIdentifyMethod } from '@granisafe/shared';

export class IdentifyDto {
  @IsIn(Object.values(AccessIdentifyMethod))
  method!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  identifier!: string;

  @IsIn(Object.values(AccessDirection))
  direction!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  accessPointCode?: string;
}
