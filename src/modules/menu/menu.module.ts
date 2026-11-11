import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { storageConfig } from '../../config';
import { BrandingModule } from '../branding/branding.module';
import { Category } from '../categories/entities/category.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { StorageModule } from '../storage/storage.module';
import { DiningTable } from '../tables/entities/dining-table.entity';
import { MenuItem } from './entities/menu-item.entity';
import { MenuItemImage } from './entities/menu-item-image.entity';
import { MenuItemsController } from './menu-items.controller';
import { MenuItemsService } from './menu-items.service';
import { MenuImagesController } from './menu-images.controller';
import { MenuImagesService } from './menu-images.service';
import { PublicMenuController } from './public-menu.controller';
import { PublicMenuService } from './public-menu.service';

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
    TypeOrmModule.forFeature([
      Restaurant,
      DiningTable,
      Category,
      MenuItem,
      MenuItemImage,
    ]),
    BrandingModule,
    RestaurantsModule,
    StorageModule,
  ],
  controllers: [
    MenuItemsController,
    MenuImagesController,
    PublicMenuController,
  ],
  providers: [MenuItemsService, MenuImagesService, PublicMenuService],
})
export class MenuModule {}
