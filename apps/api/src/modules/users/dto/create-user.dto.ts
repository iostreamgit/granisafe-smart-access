import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { RoleCode } from '@granisafe/shared';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(Object.values(RoleCode))
  role!: string;
}
