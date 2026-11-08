import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { BrandingService } from './branding.service';
import { BrandingResponseDto } from './dto/branding-response.dto';

@ApiTags('public')
@Public()
@Controller('public/branding')
export class PublicBrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get(':slug')
  @ApiOkResponse({ type: BrandingResponseDto })
  getBySlug(@Param('slug') slug: string): Promise<BrandingResponseDto> {
    return this.brandingService.getPublic(slug);
  }
}
