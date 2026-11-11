import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestaurantStatus } from '../../common/enums/restaurant-status.enum';
import { Restaurant } from './entities/restaurant.entity';

@Injectable()
export class RestaurantAvailabilityService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
  ) {}

  async assertAvailable(restaurantId: string): Promise<Restaurant> {
    const restaurant = await this.restaurants.findOne({
      where: { id: restaurantId },
    });

    if (!restaurant) {
      throw new ForbiddenException('Restaurante indisponível');
    }

    return this.assertEntityAvailable(restaurant);
  }

  assertEntityAvailable(restaurant: Restaurant): Restaurant {
    const subscriptionExpired =
      restaurant.subscriptionExpiresAt !== null &&
      restaurant.subscriptionExpiresAt.getTime() <= Date.now();

    if (restaurant.status !== RestaurantStatus.ACTIVE || subscriptionExpired) {
      throw new ForbiddenException('Restaurante indisponível');
    }

    return restaurant;
  }
}
