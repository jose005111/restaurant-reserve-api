import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';
import { CategoryResponseDto } from './category-response.dto';

export class CategoryPageDto {
  @ApiProperty({ type: [CategoryResponseDto] }) items: CategoryResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta: PaginationMetaDto;
}
