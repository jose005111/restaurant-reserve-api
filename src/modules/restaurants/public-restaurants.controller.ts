import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import {
  Body,
  Controller,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { appConfig } from '../../config';
import { PublicSignupDto } from './dto/public-signup.dto';
import { RestaurantResponseDto } from './dto/restaurant-response.dto';
import { RestaurantsService } from './restaurants.service';
import { Throttle } from '@nestjs/throttler';

@ApiErrors(400, 403, 404, 409, 429, 500)
@ApiTags('public')
@Public()
@Controller('public/signup')
export class PublicRestaurantsController {
  constructor(
    private readonly restaurantsService: RestaurantsService,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  @Post()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(201)
  @ApiCreatedResponse({ type: RestaurantResponseDto })
  signup(@Body() dto: PublicSignupDto): Promise<RestaurantResponseDto> {
    if (!this.config.allowPublicSignup) {
      throw new NotFoundException('Auto-registo indisponível');
    }

    return this.restaurantsService.signup(dto);
  }
}
