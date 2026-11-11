import { ApiErrors } from '../../common/decorators/api-errors.decorator';
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
  ApiNoContentResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateDiningTableDto } from './dto/create-dining-table.dto';
import { DiningTableResponseDto } from './dto/dining-table-response.dto';
import { TableQrResponseDto } from './dto/table-qr-response.dto';
import { UpdateDiningTableDto } from './dto/update-dining-table.dto';
import { TablesService } from './tables.service';

@ApiErrors(400, 401, 403, 404, 409, 429, 500)
@ApiTags('tables')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Post()
  @ApiCreatedResponse({ type: DiningTableResponseDto })
  create(
    @CurrentUser() currentUser: AuthUser,
    @Body() dto: CreateDiningTableDto,
  ): Promise<DiningTableResponseDto> {
    return this.tablesService.create(currentUser, dto);
  }

  @Get()
  @ApiOkResponse({ type: DiningTableResponseDto, isArray: true })
  findAll(
    @CurrentUser() currentUser: AuthUser,
  ): Promise<DiningTableResponseDto[]> {
    return this.tablesService.findAll(currentUser);
  }

  @Get(':id/qr')
  @ApiOkResponse({ type: TableQrResponseDto })
  getQr(
    @CurrentUser() currentUser: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TableQrResponseDto> {
    return this.tablesService.getQr(currentUser, id);
  }

  @Post(':id/qr/rotate')
  @HttpCode(200)
  @ApiOkResponse({ type: DiningTableResponseDto })
  rotateToken(
    @CurrentUser() currentUser: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DiningTableResponseDto> {
    return this.tablesService.rotateToken(currentUser, id);
  }

  @Get(':id')
  @ApiOkResponse({ type: DiningTableResponseDto })
  findOne(
    @CurrentUser() currentUser: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DiningTableResponseDto> {
    return this.tablesService.findOne(currentUser, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: DiningTableResponseDto })
  update(
    @CurrentUser() currentUser: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiningTableDto,
  ): Promise<DiningTableResponseDto> {
    return this.tablesService.update(currentUser, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  async remove(
    @CurrentUser() currentUser: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.tablesService.remove(currentUser, id);
  }
}
