import { OptionalField } from '../../../common/decorators/optional-field.decorator';
import {
  emptyToNull,
  emptyToUndefined,
  trimString,
} from '../../../common/utils/input.util';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsDefined,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { RestaurantPlan } from '../../../common/enums/restaurant-plan.enum';

export class CreateRestaurantAdminDto {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 72, writeOnly: true })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}

export class CreateRestaurantDto {
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

  @ApiProperty({
    required: false,
    default: RestaurantPlan.FREE,
    enum: RestaurantPlan,
  })
  @OptionalField()
  @IsEnum(RestaurantPlan)
  plan?: RestaurantPlan;

  @ApiProperty({
    required: false,
    type: String,
    format: 'date-time',
    nullable: true,
  })
  @Transform(({ value }: { value: unknown }) => emptyToNull(value))
  @IsOptional()
  @IsDateString()
  subscriptionExpiresAt?: string | null;

  @ApiProperty({ required: false, default: 10, minimum: 1 })
  @OptionalField()
  @IsInt()
  @Min(1)
  maxTables?: number;

  @ApiProperty({ required: false, default: 50, minimum: 1 })
  @OptionalField()
  @IsInt()
  @Min(1)
  maxMenuItems?: number;

  @ApiProperty({ required: false, default: 5, minimum: 1 })
  @OptionalField()
  @IsInt()
  @Min(1)
  maxUsers?: number;

  @ApiProperty({ type: CreateRestaurantAdminDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateRestaurantAdminDto)
  admin: CreateRestaurantAdminDto;
}
