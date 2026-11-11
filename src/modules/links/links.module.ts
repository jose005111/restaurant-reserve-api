import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { appConfig } from '../../config';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';

@Module({
  imports: [
    ConfigModule.forFeature(appConfig),
    TypeOrmModule.forFeature([Restaurant]),
  ],
  controllers: [LinksController],
  providers: [LinksService],
})
export class LinksModule {}
