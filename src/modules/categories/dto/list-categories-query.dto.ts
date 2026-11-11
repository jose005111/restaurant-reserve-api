import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { OptionalField } from '../../../common/decorators/optional-field.decorator';
import { queryBoolean } from '../../../common/utils/search.util';

export class ListCategoriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    description: 'Filtra categorias activas/inactivas; omitir inclui ambas.',
  })
  @Transform(({ value }: { value: unknown }) => queryBoolean(value))
  @OptionalField()
  @IsBoolean({ message: 'isActive deve ser true ou false' })
  isActive?: boolean;
}
