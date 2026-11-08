import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  Patch,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { BrandingAsset } from '../../common/enums/branding-asset.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { BrandingService } from './branding.service';
import { BrandingResponseDto } from './dto/branding-response.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';

@ApiTags('branding')
@ApiBearerAuth()
@Controller('branding')
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.COUNTER)
  @ApiOkResponse({ type: BrandingResponseDto })
  get(@CurrentUser() currentUser: AuthUser): Promise<BrandingResponseDto> {
    return this.brandingService.getForUser(currentUser);
  }

  @Patch()
  @Roles(UserRole.ADMIN)
  @ApiOkResponse({ type: BrandingResponseDto })
  update(
    @CurrentUser() currentUser: AuthUser,
    @Body() dto: UpdateBrandingDto,
  ): Promise<BrandingResponseDto> {
    return this.brandingService.update(currentUser, dto);
  }

  @Put(':asset')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOkResponse({ type: BrandingResponseDto })
  upload(
    @CurrentUser() currentUser: AuthUser,
    @Param('asset', new ParseEnumPipe(BrandingAsset))
    asset: BrandingAsset,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<BrandingResponseDto> {
    return this.brandingService.uploadAsset(currentUser, asset, file);
  }

  @Delete(':asset')
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  async remove(
    @CurrentUser() currentUser: AuthUser,
    @Param('asset', new ParseEnumPipe(BrandingAsset))
    asset: BrandingAsset,
  ): Promise<void> {
    await this.brandingService.removeAsset(currentUser, asset);
  }
}
