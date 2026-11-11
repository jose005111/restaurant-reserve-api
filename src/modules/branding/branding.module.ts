import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { storageConfig } from '../../config';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { StorageModule } from '../storage/storage.module';
import { BrandingController } from './branding.controller';
import { BrandingService } from './branding.service';
import { RestaurantBranding } from './entities/restaurant-branding.entity';
import { PublicBrandingController } from './public-branding.controller';

@Module({
  imports: [
    ConfigModule.forFeature(storageConfig),
    MulterModule.registerAsync({
      imports: [ConfigModule.forFeature(storageConfig)],
      inject: [storageConfig.KEY],
      useFactory: (config: ConfigType<typeof storageConfig>) => ({
        limits: { fileSize: config.maxUploadBytes, files: 1 },
      }),
    }),
    TypeOrmModule.forFeature([RestaurantBranding, Restaurant]),
    RestaurantsModule,
    StorageModule,
  ],
  controllers: [BrandingController, PublicBrandingController],
  providers: [BrandingService],
  exports: [BrandingService],
})
export class BrandingModule {}
