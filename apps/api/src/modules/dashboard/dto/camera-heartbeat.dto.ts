import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CameraHeartbeatDto {
  @IsString()
  @MaxLength(64)
  accessPointCode!: string;

  @IsOptional()
  @IsIn(['ONLINE', 'DEGRADED', 'OFFLINE'])
  status?: string;
}
