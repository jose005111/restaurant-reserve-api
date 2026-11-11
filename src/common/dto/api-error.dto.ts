import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message: string | string[];

  @ApiProperty()
  error: string;

  @ApiProperty({ format: 'date-time' })
  timestamp: string;

  @ApiProperty({ example: '/api/branding' })
  path: string;
}
