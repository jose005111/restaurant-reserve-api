import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  Allow,
} from 'class-validator';
import { emptyToNull, trimString } from '../../../common/utils/input.util';
export class CreatePublicOrderItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID(undefined, { message: 'O produto deve ser um UUID válido' })
  menuItemId: string;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 99 })
  @IsInt({ message: 'O valor deve ser um inteiro' })
  @Min(1, { message: 'O valor mínimo é 1' })
  @Max(99, { message: 'A quantidade máxima é 99' })
  quantity: number;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 255 })
  @Transform(({ value }: { value: unknown }) => emptyToNull(value))
  @IsOptional()
  @IsString({ message: 'O valor deve ser texto' })
  @MaxLength(255, { message: 'O texto aceita no máximo 255 caracteres' })
  note?: string | null;
}
export class CreatePublicOrderDto {
  @ApiProperty({ maxLength: 255 })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString({ message: 'O valor deve ser texto' })
  @IsNotEmpty({ message: 'O valor não pode estar vazio' })
  @MaxLength(255, { message: 'O texto aceita no máximo 255 caracteres' })
  token: string;
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description:
      'Obrigatório no link GENERIC; completamente ignorado no TABLE.',
  })
  @Allow()
  tableId?: unknown;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 50 })
  @IsInt({ message: 'O valor deve ser um inteiro' })
  @Min(1, { message: 'O valor mínimo é 1' })
  @Max(50, { message: 'O máximo de pessoas é 50' })
  guestsCount: number;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @Transform(({ value }: { value: unknown }) => emptyToNull(value))
  @IsOptional()
  @IsString({ message: 'O valor deve ser texto' })
  @MaxLength(500, { message: 'A observação aceita no máximo 500 caracteres' })
  customerNote?: string | null;
  @ApiProperty({ maxLength: 100 })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString({ message: 'O valor deve ser texto' })
  @IsNotEmpty({ message: 'O valor não pode estar vazio' })
  @MaxLength(100, { message: 'A chave aceita no máximo 100 caracteres' })
  idempotencyKey: string;
  @ApiProperty({ type: [CreatePublicOrderItemDto], minItems: 1, maxItems: 50 })
  @IsArray({ message: 'Os produtos devem ser uma lista' })
  @ArrayMinSize(1, { message: 'Escolha pelo menos um produto' })
  @ArrayMaxSize(50, { message: 'O pedido aceita no máximo 50 produtos' })
  @ValidateNested({
    each: true,
    message: 'Cada produto deve ser um objecto válido',
  })
  @Type(() => CreatePublicOrderItemDto)
  items: CreatePublicOrderItemDto[];
}
