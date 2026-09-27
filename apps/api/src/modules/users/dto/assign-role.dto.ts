import { IsIn } from 'class-validator';
import { RoleCode } from '@granisafe/shared';

export class AssignRoleDto {
  @IsIn(Object.values(RoleCode))
  role!: string;
}
