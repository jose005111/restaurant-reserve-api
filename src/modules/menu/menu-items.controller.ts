import { ListMenuItemsQueryDto } from './dto/list-menu-items-query.dto';
import { MenuItemPageDto } from './dto/menu-item-page.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { MenuItemResponseDto } from './dto/menu-item-response.dto';
import { MenuItemsService } from './menu-items.service';
import { UpdateAvailabilityDto } from './dto/image-mutations.dto';

@ApiTags('menu-items')
@ApiBearerAuth()
@ApiErrors(400, 401, 403, 404, 409, 500)
@Roles(UserRole.ADMIN)
@Controller('menu-items')
export class MenuItemsController {
  constructor(private readonly service: MenuItemsService) {}

  @Post()
  @ApiCreatedResponse({ type: MenuItemResponseDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMenuItemDto,
  ): Promise<MenuItemResponseDto> {
    return this.service.create(user, dto);
  }

  @Get()
  @ApiOkResponse({ type: MenuItemPageDto })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ListMenuItemsQueryDto,
  ): Promise<MenuItemPageDto> {
    return this.service.findAll(user, query);
  }

  @Patch(':id/availability')
  @Roles(UserRole.ADMIN, UserRole.COUNTER)
  @ApiOkResponse({ type: MenuItemResponseDto })
  updateAvailability(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAvailabilityDto,
  ): Promise<MenuItemResponseDto> {
    return this.service.updateAvailability(user, id, dto);
  }

  @Get(':id')
  @ApiOkResponse({ type: MenuItemResponseDto })
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MenuItemResponseDto> {
    return this.service.findOne(user, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: MenuItemResponseDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMenuItemDto,
  ): Promise<MenuItemResponseDto> {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.service.remove(user, id);
  }
}
