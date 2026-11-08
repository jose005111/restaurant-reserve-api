import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ThemeMode } from '../../../common/enums/theme-mode.enum';

export const ALLOWED_FONT_FAMILIES = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Nunito',
  'Source Sans 3',
  'Playfair Display',
] as const;

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export class UpdateBrandingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(HEX_COLOR, { message: 'A cor deve estar no formato #RRGGBB' })
  primaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(HEX_COLOR, { message: 'A cor deve estar no formato #RRGGBB' })
  secondaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(HEX_COLOR, { message: 'A cor deve estar no formato #RRGGBB' })
  accentColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(HEX_COLOR, { message: 'A cor deve estar no formato #RRGGBB' })
  backgroundColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(HEX_COLOR, { message: 'A cor deve estar no formato #RRGGBB' })
  surfaceColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(HEX_COLOR, { message: 'A cor deve estar no formato #RRGGBB' })
  textColor?: string;

  @ApiPropertyOptional({ enum: ThemeMode })
  @IsOptional()
  @IsEnum(ThemeMode)
  themeMode?: ThemeMode;

  @ApiPropertyOptional({ enum: ALLOWED_FONT_FAMILIES })
  @IsOptional()
  @IsIn(ALLOWED_FONT_FAMILIES)
  fontFamily?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 32 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(32)
  borderRadius?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  welcomeTitle?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  welcomeMessage?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  footerText?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'A URL deve usar https' },
  )
  @MaxLength(255)
  instagramUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'A URL deve usar https' },
  )
  @MaxLength(255)
  facebookUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'A URL deve usar https' },
  )
  @MaxLength(255)
  websiteUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsapp?: string | null;
}
