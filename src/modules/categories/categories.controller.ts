import { ListCategoriesQueryDto } from './dto/list-categories-query.dto';
import { CategoryPageDto } from './dto/category-page.dto';
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
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@ApiBearerAuth()
@ApiErrors(400, 401, 403, 404, 409, 500)
@Roles(UserRole.ADMIN)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Post()
  @ApiCreatedResponse({ type: CategoryResponseDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.service.create(user, dto);
  }

  @Get()
  @ApiOkResponse({ type: CategoryPageDto })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ListCategoriesQueryDto,
  ): Promise<CategoryPageDto> {
    return this.service.findAll(user, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: CategoryResponseDto })
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CategoryResponseDto> {
    return this.service.findOne(user, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CategoryResponseDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
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
