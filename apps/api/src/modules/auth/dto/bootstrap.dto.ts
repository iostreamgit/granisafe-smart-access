import { IsEmail, IsString, MinLength } from 'class-validator';

export class BootstrapDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @MinLength(2)
  companyName!: string;
}
