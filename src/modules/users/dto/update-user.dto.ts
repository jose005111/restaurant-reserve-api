import { OptionalField } from '../../../common/decorators/optional-field.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { STAFF_ROLES } from './create-user.dto';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @OptionalField()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @OptionalField()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ minLength: 8 })
  @OptionalField()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;

  @ApiPropertyOptional({ enum: STAFF_ROLES })
  @OptionalField()
  @IsIn(STAFF_ROLES)
  role?: UserRole;

  @ApiPropertyOptional()
  @OptionalField()
  @IsBoolean()
  isActive?: boolean;
}
