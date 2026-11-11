import { ApiProperty } from '@nestjs/swagger';
export class MenuItemImageResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) menuItemId: string;
  @ApiProperty() url: string;
  @ApiProperty({ type: String, nullable: true }) altText: string | null;
  @ApiProperty() sortOrder: number;
  @ApiProperty() isPrimary: boolean;
  @ApiProperty({ type: Date }) createdAt: Date;
}
export class MenuItemResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) restaurantId: string;
  @ApiProperty({ format: 'uuid' }) categoryId: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) description: string | null;
  @ApiProperty({ minimum: 0 }) priceCents: number;
  @ApiProperty() isAvailable: boolean;
  @ApiProperty() sortOrder: number;
  @ApiProperty({ type: [MenuItemImageResponseDto] })
  images: MenuItemImageResponseDto[];
  @ApiProperty({ type: Date }) createdAt: Date;
  @ApiProperty({ type: Date }) updatedAt: Date;
}
