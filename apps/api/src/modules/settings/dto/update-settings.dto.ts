import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, Max, Min, ValidateNested } from 'class-validator';

class PpeThresholdsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  helmet?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  safetyVest?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  uniform?: number;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60_000)
  gateOpenMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(3600)
  accessCooldownSeconds?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(120)
  defaultLateGraceMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3650)
  evidenceRetentionDays?: number;

  @IsOptional()
  @IsBoolean()
  failClosed?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PpeThresholdsDto)
  ppeThresholds?: PpeThresholdsDto;
}
