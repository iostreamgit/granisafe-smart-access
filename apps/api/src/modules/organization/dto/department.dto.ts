import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[A-Z0-9_-]{2,32}$/i)
  code!: string;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9_-]{2,32}$/i)
  code?: string;
}
