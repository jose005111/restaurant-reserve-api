import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { OptionalField } from '../../../common/decorators/optional-field.decorator';
import { emptyToNull } from '../../../common/utils/input.util';
export class UploadMenuImageDto {
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 150 })
  @Transform(({ value }: { value: unknown }) => emptyToNull(value))
  @IsOptional()
  @IsString({ message: 'O texto alternativo deve ser texto' })
  @MaxLength(150, { message: 'O máximo é 150 caracteres' })
  altText?: string | null;
}
export class UpdateMenuImageDto extends UploadMenuImageDto {
  @ApiPropertyOptional({
    description:
      'true define esta imagem como principal; false não pode desmarcar a principal actual.',
  })
  @OptionalField()
  @IsBoolean({ message: 'isPrimary deve ser booleano' })
  isPrimary?: boolean;
}
export class ReorderMenuImagesDto {
  @ApiProperty({
    type: [String],
    description:
      'Todos os IDs de imagens do prato, sem repetições, na ordem desejada.',
  })
  @IsArray({ message: 'Envie uma lista de imagens' })
  @ArrayMinSize(1, { message: 'Envie pelo menos uma imagem' })
  @ArrayMaxSize(100, { message: 'O máximo é 100 imagens' })
  @ArrayUnique({ message: 'As imagens não podem repetir-se' })
  @IsUUID('all', { each: true, message: 'ID de imagem inválido' })
  imageIds: string[];
}
export class UpdateAvailabilityDto {
  @ApiProperty()
  @IsBoolean({ message: 'isAvailable deve ser booleano' })
  isAvailable: boolean;
}
