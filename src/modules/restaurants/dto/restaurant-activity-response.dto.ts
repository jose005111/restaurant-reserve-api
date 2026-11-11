import { ApiProperty } from '@nestjs/swagger';

export class RestaurantActivityResponseDto {
  @ApiProperty()
  restaurantId: string;

  @ApiProperty()
  tablesCount: number;

  @ApiProperty()
  menuItemsCount: number;

  @ApiProperty()
  activeUsersCount: number;

  @ApiProperty({ description: 'Pedidos criados nos últimos 30 dias' })
  ordersCount30Days: number;

  @ApiProperty({
    description: 'Valor dos pedidos aceites nos últimos 30 dias, em cêntimos',
  })
  salesCents30Days: number;

  @ApiProperty({ type: Date, nullable: true })
  lastOrderAt: Date | null;
}
