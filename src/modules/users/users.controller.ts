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
  Query,
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
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiErrors(400, 401, 403, 404, 409, 429, 500)
@ApiTags('users')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiCreatedResponse({ type: UserResponseDto })
  create(
    @CurrentUser() currentUser: AuthUser,
    @Body() dto: CreateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.create(currentUser, dto);
  }

  @Get()
  @ApiOkResponse({ type: UserResponseDto, isArray: true })
  findAll(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListUsersQueryDto,
  ): Promise<UserResponseDto[]> {
    return this.usersService.findAll(currentUser, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: UserResponseDto })
  findOne(
    @CurrentUser() currentUser: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return this.usersService.findOne(currentUser, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: UserResponseDto })
  update(
    @CurrentUser() currentUser: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(currentUser, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  async remove(
    @CurrentUser() currentUser: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.usersService.remove(currentUser, id);
  }
}
