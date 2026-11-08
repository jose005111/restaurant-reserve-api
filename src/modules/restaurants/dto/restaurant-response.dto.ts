import { ApiProperty } from '@nestjs/swagger';
import { RestaurantPlan } from '../../../common/enums/restaurant-plan.enum';
import { RestaurantStatus } from '../../../common/enums/restaurant-status.enum';

export class RestaurantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ type: String, nullable: true })
  phone: string | null;

  @ApiProperty({ type: String, nullable: true })
  address: string | null;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  publicToken: string;

  @ApiProperty({ enum: RestaurantStatus })
  status: RestaurantStatus;

  @ApiProperty({ enum: RestaurantPlan })
  plan: RestaurantPlan;

  @ApiProperty({ type: Date, nullable: true })
  subscriptionExpiresAt: Date | null;

  @ApiProperty()
  maxTables: number;

  @ApiProperty()
  maxMenuItems: number;

  @ApiProperty()
  maxUsers: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
