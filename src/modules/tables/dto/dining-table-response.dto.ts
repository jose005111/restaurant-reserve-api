import { ApiProperty } from '@nestjs/swagger';

export class DiningTableResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  restaurantId: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  qrToken: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
