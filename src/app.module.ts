import { OrdersModule } from './modules/orders/orders.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { MenuModule } from './modules/menu/menu.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import {
  appConfig,
  databaseConfig,
  storageConfig,
  validateEnv,
} from './config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RestaurantsModule } from './modules/restaurants/restaurants.module';
import { TablesModule } from './modules/tables/tables.module';
import { LinksModule } from './modules/links/links.module';
import { BrandingModule } from './modules/branding/branding.module';
import { SecurityModule } from './common/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.dev', '.env'],
      load: [appConfig, databaseConfig, storageConfig],
      validate: validateEnv,
      cache: true,
    }),
    SecurityModule,
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (db: ConfigType<typeof databaseConfig>) => ({
        ...db,
        autoLoadEntities: true,
      }),
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    RestaurantsModule,
    TablesModule,
    LinksModule,
    BrandingModule,
    CategoriesModule,
    MenuModule,
    OrdersModule,
    ReportsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
