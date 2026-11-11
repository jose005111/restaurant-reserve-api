import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsOptional,
} from 'class-validator';
import { OptionalField } from '../../../common/decorators/optional-field.decorator';
import { emptyToNull, trimString } from '../../../common/utils/input.util';

export class UpdateMenuItemDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalField()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsUUID('all', { message: 'Categoria inválida' })
  categoryId?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 150 })
  @OptionalField()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString({ message: 'O valor deve ser texto' })
  @MinLength(1, { message: 'O nome é obrigatório' })
  @MaxLength(150, { message: 'Texto demasiado longo' })
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => emptyToNull(value))
  @IsString({ message: 'O valor deve ser texto' })
  @MaxLength(5000, { message: 'Texto demasiado longo' })
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 2147483647 })
  @OptionalField()
  @IsInt({ message: 'O valor deve ser um inteiro' })
  @Min(0, { message: 'O valor mínimo é 0' })
  @Max(2147483647, { message: 'O valor excede o máximo permitido' })
  priceCents?: number;

  @ApiPropertyOptional()
  @OptionalField()
  @IsBoolean({ message: 'O valor deve ser booleano' })
  isAvailable?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 2147483647 })
  @OptionalField()
  @IsInt({ message: 'O valor deve ser um inteiro' })
  @Min(0, { message: 'O valor mínimo é 0' })
  @Max(2147483647, { message: 'O valor excede o máximo permitido' })
  sortOrder?: number;
}
