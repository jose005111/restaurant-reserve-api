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

  @ApiProperty()
  primaryColor: string;

  @ApiProperty()
  secondaryColor: string;

  @ApiProperty()
  accentColor: string;

  @ApiProperty()
  backgroundColor: string;

  @ApiProperty()
  surfaceColor: string;

  @ApiProperty()
  textColor: string;

  @ApiProperty({ enum: ThemeMode })
  themeMode: ThemeMode;

  @ApiProperty({ type: String, nullable: true })
  fontFamily: string | null;

  @ApiProperty()
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
