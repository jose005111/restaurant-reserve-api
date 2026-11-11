import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination.dto';
import { MenuItemResponseDto } from './menu-item-response.dto';

export class MenuItemPageDto {
  @ApiProperty({ type: [MenuItemResponseDto] }) items: MenuItemResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta: PaginationMetaDto;
}
