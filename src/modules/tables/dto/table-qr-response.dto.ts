import { ApiProperty } from '@nestjs/swagger';

export class TableQrResponseDto {
  @ApiProperty()
  tableId: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  url: string;

  @ApiProperty({ description: 'QR code em data URL (PNG)' })
  qrCode: string;
}
