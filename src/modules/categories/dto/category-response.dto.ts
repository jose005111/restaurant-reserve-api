import { ApiProperty } from '@nestjs/swagger';
export class CategoryResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) restaurantId: string;
  @ApiProperty() name: string;
  @ApiProperty() sortOrder: number;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ type: Date }) createdAt: Date;
  @ApiProperty({ type: Date }) updatedAt: Date;
}
