import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { OptionalField } from '../../../common/decorators/optional-field.decorator';
import { trimString } from '../../../common/utils/input.util';

export class CreateCategoryDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString({ message: 'O valor deve ser texto' })
  @MinLength(1, { message: 'O nome é obrigatório' })
  @MaxLength(100, { message: 'Texto demasiado longo' })
  name: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 2147483647, default: 0 })
  @OptionalField()
  @IsInt({ message: 'O valor deve ser um inteiro' })
  @Min(0, { message: 'O valor mínimo é 0' })
  @Max(2147483647, { message: 'O valor excede o máximo permitido' })
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @OptionalField()
  @IsBoolean({ message: 'O valor deve ser booleano' })
  isActive?: boolean;
}
