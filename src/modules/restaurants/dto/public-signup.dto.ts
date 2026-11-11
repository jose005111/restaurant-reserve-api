import { OptionalField } from '../../../common/decorators/optional-field.decorator';
import {
  emptyToNull,
  emptyToUndefined,
  trimString,
} from '../../../common/utils/input.util';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CreateRestaurantAdminDto } from './create-restaurant.dto';

export class PublicSignupDto {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @ApiProperty({ required: false })
  @Transform(({ value }: { value: unknown }) => emptyToUndefined(value))
  @OptionalField()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'O slug deve conter apenas letras minúsculas, números e hífenes',
  })
  slug?: string;

  @ApiProperty({ required: false, type: String, nullable: true })
  @Transform(({ value }: { value: unknown }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiProperty({ required: false, type: String, nullable: true })
  @Transform(({ value }: { value: unknown }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string | null;

  @ApiProperty({ required: false, default: 'AOA' })
  @OptionalField()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() || undefined : value,
  )
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'A moeda deve ter 3 letras' })
  currency?: string;

  @ApiProperty({ type: CreateRestaurantAdminDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateRestaurantAdminDto)
  admin: CreateRestaurantAdminDto;
}
