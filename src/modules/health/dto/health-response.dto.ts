import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty()
  status: string;

  @ApiProperty()
  database: string;

  @ApiProperty()
  timestamp: string;

  @ApiProperty()
  uptime: number;
}
