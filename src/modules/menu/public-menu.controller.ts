import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PublicMenuResponseDto } from './dto/public-menu-response.dto';
import { PublicMenuService } from './public-menu.service';

@ApiTags('public')
@ApiErrors(403, 404, 429, 500)
@Public()
@Controller('public/menu')
export class PublicMenuController {
  constructor(private readonly menu: PublicMenuService) {}

  @Get(':token')
  @ApiParam({
    name: 'token',
    description: 'qrToken de uma mesa activa ou publicToken do restaurante.',
  })
  @ApiOkResponse({ type: PublicMenuResponseDto })
  getMenu(@Param('token') token: string): Promise<PublicMenuResponseDto> {
    return this.menu.getMenu(token);
  }
}
