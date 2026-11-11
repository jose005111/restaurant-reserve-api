import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { RestaurantStatus } from '../../../common/enums/restaurant-status.enum';

export class UpdateRestaurantStatusDto {
  @ApiProperty({ enum: RestaurantStatus })
  @IsEnum(RestaurantStatus)
  status: RestaurantStatus;
}
