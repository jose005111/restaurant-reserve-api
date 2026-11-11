import { ApiProperty } from '@nestjs/swagger';

export class DailySummaryDto {
  @ApiProperty({ format: 'date' }) date: string;
  @ApiProperty({ type: 'integer' }) ordersCount: number;
  @ApiProperty({ type: 'integer' }) salesCents: number;
}

export class TopItemDto {
  @ApiProperty({ format: 'uuid' }) menuItemId: string;
  @ApiProperty() nameSnapshot: string;
  @ApiProperty({ type: 'integer' }) quantity: number;
  @ApiProperty({ type: 'integer' }) salesCents: number;
}

export class SummaryResponseDto {
  @ApiProperty({ format: 'date' }) from: string;
  @ApiProperty({ format: 'date' }) to: string;
  @ApiProperty() currency: string;
  @ApiProperty({ type: 'integer' }) ordersCount: number;
  @ApiProperty({ type: 'integer' }) salesCents: number;
  @ApiProperty({ type: [DailySummaryDto] }) days: DailySummaryDto[];
  @ApiProperty({ type: [TopItemDto] }) topItems: TopItemDto[];
}
