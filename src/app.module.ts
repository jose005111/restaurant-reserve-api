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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.dev', '.env'],
      load: [appConfig, databaseConfig, storageConfig],
      validate: validateEnv,
      cache: true,
    }),
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
