import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import type { AuthUser } from './interfaces/auth-user.interface';
import { Throttle } from '@nestjs/throttler';

@ApiErrors(400, 401, 403, 404, 409, 429, 500)
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @ApiOkResponse({ type: AuthResponseDto })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOkResponse({ type: AuthUserDto })
  me(@CurrentUser() user: AuthUser): AuthUserDto {
    return user;
  }
}
