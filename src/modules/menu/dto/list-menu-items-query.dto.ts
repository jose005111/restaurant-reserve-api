import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { OptionalField } from '../../../common/decorators/optional-field.decorator';
import { queryBoolean } from '../../../common/utils/search.util';

export class ListMenuItemsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalField()
  @IsUUID('all', { message: 'categoryId deve ser um UUID válido' })
  categoryId?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Filtra produtos disponíveis/indisponíveis; omitir inclui ambos.',
  })
  @Transform(({ value }: { value: unknown }) => queryBoolean(value))
  @OptionalField()
  @IsBoolean({ message: 'isAvailable deve ser true ou false' })
  isAvailable?: boolean;
}
