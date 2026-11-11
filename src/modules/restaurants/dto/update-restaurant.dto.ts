import { OptionalField } from '../../../common/decorators/optional-field.decorator';
import { emptyToNull, trimString } from '../../../common/utils/input.util';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { RestaurantPlan } from '../../../common/enums/restaurant-plan.enum';

export class UpdateRestaurantDto {
  @ApiPropertyOptional()
  @OptionalField()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @OptionalField()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'O slug deve conter apenas letras minúsculas, números e hífenes',
  })
  slug?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(({ value }: { value: unknown }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(({ value }: { value: unknown }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string | null;

  @ApiPropertyOptional()
  @OptionalField()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() || undefined : value,
  )
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'A moeda deve ter 3 letras' })
  currency?: string;

  @ApiPropertyOptional({ enum: RestaurantPlan })
  @OptionalField()
  @IsEnum(RestaurantPlan)
  plan?: RestaurantPlan;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Transform(({ value }: { value: unknown }) => emptyToNull(value))
  @IsOptional()
  @IsDateString()
  subscriptionExpiresAt?: string | null;

  @ApiPropertyOptional({ minimum: 1 })
  @OptionalField()
  @IsInt()
  @Min(1)
  maxTables?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @OptionalField()
  @IsInt()
  @Min(1)
  maxMenuItems?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @OptionalField()
  @IsInt()
  @Min(1)
  maxUsers?: number;
}
