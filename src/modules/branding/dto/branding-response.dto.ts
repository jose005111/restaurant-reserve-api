import { ApiProperty } from '@nestjs/swagger';
import { ThemeMode } from '../../../common/enums/theme-mode.enum';

export class BrandingResponseDto {
  @ApiProperty({ type: String, nullable: true })
  logoUrl: string | null;

  @ApiProperty({ type: String, nullable: true })
  logoDarkUrl: string | null;

  @ApiProperty({ type: String, nullable: true })
  faviconUrl: string | null;

  @ApiProperty({ type: String, nullable: true })
  bannerUrl: string | null;

  @ApiProperty({ type: String, nullable: true })
  loginImageUrl: string | null;

  @ApiProperty({ default: '#111827', pattern: '^#[0-9A-Fa-f]{6}$' })
  primaryColor: string;

  @ApiProperty({ default: '#6B7280', pattern: '^#[0-9A-Fa-f]{6}$' })
  secondaryColor: string;

  @ApiProperty({ default: '#F59E0B', pattern: '^#[0-9A-Fa-f]{6}$' })
  accentColor: string;

  @ApiProperty({ default: '#FFFFFF', pattern: '^#[0-9A-Fa-f]{6}$' })
  backgroundColor: string;

  @ApiProperty({ default: '#F9FAFB', pattern: '^#[0-9A-Fa-f]{6}$' })
  surfaceColor: string;

  @ApiProperty({ default: '#111827', pattern: '^#[0-9A-Fa-f]{6}$' })
  textColor: string;

  @ApiProperty({ enum: ThemeMode, default: ThemeMode.LIGHT })
  themeMode: ThemeMode;

  @ApiProperty({ type: String, nullable: true })
  fontFamily: string | null;

  @ApiProperty({ default: 12, minimum: 0, maximum: 32 })
  borderRadius: number;

  @ApiProperty({ type: String, nullable: true })
  welcomeTitle: string | null;

  @ApiProperty({ type: String, nullable: true })
  welcomeMessage: string | null;

  @ApiProperty({ type: String, nullable: true })
  footerText: string | null;

  @ApiProperty({ type: String, nullable: true })
  instagramUrl: string | null;

  @ApiProperty({ type: String, nullable: true })
  facebookUrl: string | null;

  @ApiProperty({ type: String, nullable: true })
  websiteUrl: string | null;

  @ApiProperty({ type: String, nullable: true })
  whatsapp: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
