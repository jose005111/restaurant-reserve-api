import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../../common/enums/user-role.enum';

export const STAFF_ROLES = [UserRole.ADMIN, UserRole.COUNTER] as const;

export class CreateUserDto {
  @ApiPropertyOptional({
    description: 'Obrigatório quando o utilizador autenticado é SUPER_ADMIN',
  })
  @IsOptional()
  @IsUUID()
  restaurantId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ enum: STAFF_ROLES })
  @IsIn(STAFF_ROLES)
  role: UserRole;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
