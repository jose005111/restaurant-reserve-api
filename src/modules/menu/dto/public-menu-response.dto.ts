import { ApiProperty } from '@nestjs/swagger';
import { BrandingResponseDto } from '../../branding/dto/branding-response.dto';
export enum MenuLinkType {
  TABLE = 'TABLE',
  GENERIC = 'GENERIC',
}
export class PublicRestaurantDto {
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty() currency: string;
  @ApiProperty({ type: String, nullable: true }) phone: string | null;
  @ApiProperty({ type: String, nullable: true }) address: string | null;
}
export class PublicTableDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() label: string;
}
export class PublicMenuImageDto {
  @ApiProperty() url: string;
  @ApiProperty({ type: String, nullable: true }) altText: string | null;
  @ApiProperty() sortOrder: number;
  @ApiProperty() isPrimary: boolean;
}
export class PublicMenuItemDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) description: string | null;
  @ApiProperty({ minimum: 0 }) priceCents: number;
  @ApiProperty({ type: [PublicMenuImageDto] }) images: PublicMenuImageDto[];
}
export class PublicCategoryDto {
  @ApiProperty() name: string;
  @ApiProperty({ type: [PublicMenuItemDto] }) items: PublicMenuItemDto[];
}
export class PublicMenuResponseDto {
  @ApiProperty({ enum: MenuLinkType }) linkType: MenuLinkType;
  @ApiProperty({ type: PublicRestaurantDto }) restaurant: PublicRestaurantDto;
  @ApiProperty({ type: BrandingResponseDto }) branding: BrandingResponseDto;
  @ApiProperty({ type: PublicTableDto, nullable: true })
  table: PublicTableDto | null;
  @ApiProperty({ type: [PublicTableDto] }) tables: PublicTableDto[];
  @ApiProperty({ type: [PublicCategoryDto] }) categories: PublicCategoryDto[];
}
