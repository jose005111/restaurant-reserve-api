import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantAvailabilityService } from './restaurant-availability.service';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';
import { Restaurant } from './entities/restaurant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Restaurant])],
  controllers: [RestaurantsController],
  providers: [RestaurantAvailabilityService, RestaurantsService],
  exports: [RestaurantAvailabilityService, RestaurantsService],
})
export class RestaurantsModule {}
