import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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
import {
  ReorderMenuImagesDto,
  UpdateMenuImageDto,
  UploadMenuImageDto,
} from './dto/image-mutations.dto';
import { MenuItemImageResponseDto } from './dto/menu-item-response.dto';
import { MenuImagesService } from './menu-images.service';

@ApiTags('menu-images')
@ApiBearerAuth()
@ApiErrors(400, 401, 403, 404, 409, 413, 500)
@Roles(UserRole.ADMIN)
@Controller('menu-items/:id/images')
export class MenuImagesController {
  constructor(private readonly service: MenuImagesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        altText: { type: 'string', nullable: true, maxLength: 150 },
      },
    },
  })
  @ApiCreatedResponse({ type: MenuItemImageResponseDto })
  upload(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadMenuImageDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MenuItemImageResponseDto> {
    return this.service.upload(user, id, dto, file);
  }

  @Patch('reorder')
  @ApiOkResponse({ type: MenuItemImageResponseDto, isArray: true })
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderMenuImagesDto,
  ): Promise<MenuItemImageResponseDto[]> {
    return this.service.reorder(user, id, dto);
  }

  @Patch(':imageId')
  @ApiOkResponse({ type: MenuItemImageResponseDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: UpdateMenuImageDto,
  ): Promise<MenuItemImageResponseDto> {
    return this.service.update(user, id, imageId, dto);
  }

  @Delete(':imageId')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ): Promise<void> {
    return this.service.remove(user, id, imageId);
  }
}
