import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../../../common/enums/order-status.enum';

export class DashboardStatusCountDto {
  @ApiProperty({ enum: OrderStatus }) status: OrderStatus;
  @ApiProperty({ type: 'integer' }) count: number;
}

export class DashboardDayDto {
  @ApiProperty({ format: 'date' }) date: string;
  @ApiProperty({ type: 'integer' }) ordersCount: number;
  @ApiProperty({ type: 'integer' }) deliveredCount: number;
  @ApiProperty({ type: 'integer' }) cancelledCount: number;
  @ApiProperty({ type: 'integer' }) salesCents: number;
}

export class DashboardHourDto {
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 23 }) hour: number;
  @ApiProperty({ type: 'integer' }) ordersCount: number;
}

export class DashboardRecentOrderDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: 'integer' }) number: number;
  @ApiProperty() tableLabel: string;
  @ApiProperty({ enum: OrderStatus }) status: OrderStatus;
  @ApiProperty({ type: 'integer' }) guestsCount: number;
  @ApiProperty({ type: 'integer' }) totalCents: number;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt: Date;
}

export class DashboardResponseDto {
  @ApiProperty({ format: 'date' }) from: string;
  @ApiProperty({ format: 'date' }) to: string;
  @ApiProperty() currency: string;
  @ApiProperty({ type: 'integer' }) ordersCount: number;
  @ApiProperty({ type: 'integer' }) activeCount: number;
  @ApiProperty({ type: 'integer' }) completedCount: number;
  @ApiProperty({ type: 'integer' }) cancelledCount: number;
  @ApiProperty({ type: 'integer' }) rejectedCount: number;
  @ApiProperty({ type: 'integer' }) salesCents: number;
  @ApiProperty({ type: 'integer', nullable: true })
  averageTicketCents: number | null;
  @ApiProperty({ type: 'integer', nullable: true })
  averageAcceptanceMinutes: number | null;
  @ApiProperty({ type: 'integer', nullable: true })
  averagePreparationMinutes: number | null;
  @ApiProperty({ type: 'integer', nullable: true })
  averageDeliveryMinutes: number | null;
  @ApiProperty({ type: [DashboardStatusCountDto] })
  statusCounts: DashboardStatusCountDto[];
  @ApiProperty({ type: [DashboardDayDto] }) days: DashboardDayDto[];
  @ApiProperty({ type: [DashboardHourDto] }) hours: DashboardHourDto[];
  @ApiProperty({ type: [DashboardRecentOrderDto] })
  recentOrders: DashboardRecentOrderDto[];
}
