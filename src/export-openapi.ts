import { PublicOrdersController } from './modules/orders/orders.public.controller';
import { OrdersService } from './modules/orders/orders.service';
import { StaffOrdersController } from './modules/orders/staff-orders.controller';
import { StaffOrdersService } from './modules/orders/staff-orders.service';
import { ReportsController } from './modules/reports/reports.controller';
import { ReportsService } from './modules/reports/reports.service';
import { OrderEventsService } from './modules/orders/order-events.service';
import { CategoriesController } from './modules/categories/categories.controller';
import { CategoriesService } from './modules/categories/categories.service';
import { MenuItemsController } from './modules/menu/menu-items.controller';
import { MenuItemsService } from './modules/menu/menu-items.service';
import { MenuImagesController } from './modules/menu/menu-images.controller';
import { MenuImagesService } from './modules/menu/menu-images.service';
import { PublicMenuController } from './modules/menu/public-menu.controller';
import { PublicMenuService } from './modules/menu/public-menu.service';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { mkdir, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { appConfig } from './config';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { BrandingController } from './modules/branding/branding.controller';
import { BrandingService } from './modules/branding/branding.service';
import { PublicBrandingController } from './modules/branding/public-branding.controller';
import { HealthController } from './modules/health/health.controller';
import { LinksController } from './modules/links/links.controller';
import { LinksService } from './modules/links/links.service';
import { PublicRestaurantsController } from './modules/restaurants/public-restaurants.controller';
import { RestaurantsController } from './modules/restaurants/restaurants.controller';
import { RestaurantsService } from './modules/restaurants/restaurants.service';
import { TablesController } from './modules/tables/tables.controller';
import { TablesService } from './modules/tables/tables.service';
import { UsersController } from './modules/users/users.controller';
import { UsersService } from './modules/users/users.service';
import { DataSource } from 'typeorm';
import { setupApp } from './setup-app';

// Swagger reads controller/DTO metadata only. No application configuration,
// credentials, database connection or HTTP listener is needed for this export.
@Module({
  controllers: [
    AuthController,
    BrandingController,
    PublicBrandingController,
    HealthController,
    LinksController,
    PublicRestaurantsController,
    RestaurantsController,
    TablesController,
    UsersController,
    CategoriesController,
    MenuItemsController,
    MenuImagesController,
    PublicMenuController,
    PublicOrdersController,
    StaffOrdersController,
    ReportsController,
  ],
  providers: [
    ...[
      AuthService,
      BrandingService,
      LinksService,
      RestaurantsService,
      TablesService,
      UsersService,
      CategoriesService,
      MenuItemsService,
      MenuImagesService,
      PublicMenuService,
      OrdersService,
      StaffOrdersService,
      ReportsService,
      OrderEventsService,
      DataSource,
    ].map((provide) => ({ provide, useValue: {} })),
    { provide: appConfig.KEY, useValue: { allowPublicSignup: false } },
  ],
})
class OpenApiModule {}

async function exportOpenApi() {
  const app = await NestFactory.create<NestExpressApplication>(OpenApiModule, {
    logger: false,
  });
  try {
    const document = setupApp(app, {
      storageLocalPath: 'uploads',
      corsOrigins: [],
    });
    const directory = resolve(process.cwd(), 'docs');
    await mkdir(directory, { recursive: true });
    await writeFile(
      resolve(directory, 'openapi.json'),
      `${JSON.stringify(document, null, 2)}\n`,
    );
    console.log('OpenAPI exported to docs/openapi.json');
  } finally {
    await app.close();
  }
}
void exportOpenApi();
