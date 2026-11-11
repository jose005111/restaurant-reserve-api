import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import QRCode from 'qrcode';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../../common/utils/database-error.util';
import { generateToken } from '../../common/utils/token.util';
import { appConfig } from '../../config';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { GenericLinkResponseDto } from './dto/generic-link-response.dto';

@Injectable()
export class LinksService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
  ) {}

  async getGeneric(currentUser: AuthUser): Promise<GenericLinkResponseDto> {
    const restaurant = await this.getRestaurantOrFail(currentUser);
    return this.buildResponse(restaurant.publicToken);
  }

  async rotateGeneric(currentUser: AuthUser): Promise<GenericLinkResponseDto> {
    const restaurant = await this.getRestaurantOrFail(currentUser);
    restaurant.publicToken = generateToken();

    try {
      await this.restaurants.save(restaurant);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'Não foi possível gerar um novo token, tente novamente',
        );
      }

      throw error;
    }

    return this.buildResponse(restaurant.publicToken);
  }

  private async getRestaurantOrFail(
    currentUser: AuthUser,
  ): Promise<Restaurant> {
    if (!currentUser.restaurantId) {
      throw new ForbiddenException('Restaurante indisponível');
    }

    const restaurant = await this.restaurants.findOne({
      where: { id: currentUser.restaurantId },
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurante não encontrado');
    }

    return restaurant;
  }

  private async buildResponse(token: string): Promise<GenericLinkResponseDto> {
    const url = `${this.app.publicMenuBaseUrl}/${token}`;
    const qrCode = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 512,
    });

    return { url, qrCode };
  }
}
