import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class CreateReportDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsIn(['XLSX', 'PDF'])
  format!: 'XLSX' | 'PDF';
}
