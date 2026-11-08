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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { RestaurantResponseDto } from './dto/restaurant-response.dto';
import { UpdateRestaurantStatusDto } from './dto/update-restaurant-status.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { RestaurantsService } from './restaurants.service';

@ApiTags('restaurants')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Post()
  @ApiCreatedResponse({ type: RestaurantResponseDto })
  create(@Body() dto: CreateRestaurantDto): Promise<RestaurantResponseDto> {
    return this.restaurantsService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: RestaurantResponseDto, isArray: true })
  findAll(): Promise<RestaurantResponseDto[]> {
    return this.restaurantsService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: RestaurantResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RestaurantResponseDto> {
    return this.restaurantsService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: RestaurantResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRestaurantDto,
  ): Promise<RestaurantResponseDto> {
    return this.restaurantsService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOkResponse({ type: RestaurantResponseDto })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRestaurantStatusDto,
  ): Promise<RestaurantResponseDto> {
    return this.restaurantsService.updateStatus(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.restaurantsService.remove(id);
  }
}
