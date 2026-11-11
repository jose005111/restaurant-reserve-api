import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { OptionalField } from '../decorators/optional-field.decorator';
import { emptyToUndefined } from '../utils/input.util';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    default: 1,
    minimum: 1,
    maximum: 1000000,
  })
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt({ message: 'A página deve ser um inteiro' })
  @Min(1, { message: 'A página mínima é 1' })
  @Max(1000000, { message: 'A página máxima é 1000000' })
  page = 1;

  @ApiPropertyOptional({
    type: 'integer',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt({ message: 'O limite deve ser um inteiro' })
  @Min(1, { message: 'O limite mínimo é 1' })
  @Max(100, { message: 'O limite máximo é 100' })
  limit = 20;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Parte literal do nome, sem distinguir maiúsculas/minúsculas.',
  })
  @Transform(({ value }: { value: unknown }) => emptyToUndefined(value))
  @OptionalField()
  @IsString({ message: 'A pesquisa deve ser texto' })
  @MaxLength(100, { message: 'A pesquisa aceita no máximo 100 caracteres' })
  search?: string;
}

export class PaginationMetaDto {
  @ApiProperty({ type: 'integer', minimum: 0 }) total: number;
  @ApiProperty({ type: 'integer', minimum: 1 }) page: number;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100 }) limit: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) totalPages: number;
}

export function paginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMetaDto {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}
