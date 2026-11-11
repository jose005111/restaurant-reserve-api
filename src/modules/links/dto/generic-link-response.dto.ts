import { ApiProperty } from '@nestjs/swagger';

export class GenericLinkResponseDto {
  @ApiProperty()
  url: string;

  @ApiProperty({ description: 'QR code em data URL (PNG)' })
  qrCode: string;
}
