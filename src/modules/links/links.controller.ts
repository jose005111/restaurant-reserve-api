import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { GenericLinkResponseDto } from './dto/generic-link-response.dto';
import { LinksService } from './links.service';

@ApiErrors(400, 401, 403, 404, 409, 429, 500)
@ApiTags('links')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Get('generic')
  @ApiOkResponse({ type: GenericLinkResponseDto })
  getGeneric(
    @CurrentUser() currentUser: AuthUser,
  ): Promise<GenericLinkResponseDto> {
    return this.linksService.getGeneric(currentUser);
  }

  @Post('generic/rotate')
  @HttpCode(200)
  @ApiOkResponse({ type: GenericLinkResponseDto })
  rotateGeneric(
    @CurrentUser() currentUser: AuthUser,
  ): Promise<GenericLinkResponseDto> {
    return this.linksService.rotateGeneric(currentUser);
  }
}
