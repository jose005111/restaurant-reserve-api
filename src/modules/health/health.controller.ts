import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';
import { HealthResponseDto } from './dto/health-response.dto';
import { SkipThrottle } from '@nestjs/throttler';

@ApiErrors(400, 403, 404, 409, 429, 500)
@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  async check(): Promise<HealthResponseDto> {
    await this.dataSource.query('SELECT 1');

    return {
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
