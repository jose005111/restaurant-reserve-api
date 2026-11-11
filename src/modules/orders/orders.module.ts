import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { PublicOrdersController } from './orders.public.controller';
import { OrdersService } from './orders.service';
import { StaffOrdersController } from './staff-orders.controller';
import { StaffOrdersService } from './staff-orders.service';
import { OrderEventsService } from './order-events.service';
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    TypeOrmModule.forFeature([Order, OrderItem]),
    RestaurantsModule,
  ],
  controllers: [PublicOrdersController, StaffOrdersController],
  providers: [OrdersService, StaffOrdersService, OrderEventsService],
})
export class OrdersModule {}
