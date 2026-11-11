import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../../../common/enums/order-status.enum';
export class CreatePublicOrderResponseDto {
  @ApiProperty() publicCode: string;
  @ApiProperty({ type: 'integer' }) number: number;
  @ApiProperty({ enum: OrderStatus }) status: OrderStatus;
  @ApiProperty({ example: 'Pedido enviado' }) message: string;
}
export class PublicOrderItemResponseDto {
  @ApiProperty() nameSnapshot: string;
  @ApiProperty({ type: 'integer' }) unitPriceCents: number;
  @ApiProperty({ type: 'integer' }) quantity: number;
  @ApiProperty({ type: String, nullable: true }) note: string | null;
  @ApiProperty({ type: 'integer' }) lineTotalCents: number;
}
export class PublicOrderResponseDto {
  @ApiProperty() publicCode: string;
  @ApiProperty({ type: 'integer' }) number: number;
  @ApiProperty({ type: String, format: 'date' }) orderDate: string;
  @ApiProperty({ enum: OrderStatus }) status: OrderStatus;
  @ApiProperty() restaurantName: string;
  @ApiProperty() currency: string;
  @ApiProperty() tableLabel: string;
  @ApiProperty({ type: 'integer' }) guestsCount: number;
  @ApiProperty({ type: String, nullable: true }) customerNote: string | null;
  @ApiProperty({ type: [PublicOrderItemResponseDto] })
  items: PublicOrderItemResponseDto[];
  @ApiProperty({ type: 'integer' }) totalCents: number;
  @ApiProperty({ type: 'integer', nullable: true }) estimatedPrepMinutes:
    number | null;
  @ApiProperty({ type: String, nullable: true }) rejectionReason: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  acceptedAt: Date | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readyAt: Date | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  deliveredAt: Date | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  cancelledAt: Date | null;
}
