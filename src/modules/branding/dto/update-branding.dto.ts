import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
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
import { OptionalField } from '../../../common/decorators/optional-field.decorator';
import { emptyToNull, trimString } from '../../../common/utils/input.util';
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

/** Omit a field to keep it; null/blank clears nullable fields only. */
export class UpdateBrandingDto {
  @ApiPropertyOptional({
    type: String,
    pattern: '^#[0-9A-Fa-f]{6}$',
    example: '#111827',
    description: 'Omitir para manter a cor actual; não aceita null nem vazio.',
  })
  @OptionalField()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @Matches(HEX_COLOR, { message: 'A cor deve estar no formato #RRGGBB' })
  primaryColor?: string;

  @ApiPropertyOptional({
    type: String,
    pattern: '^#[0-9A-Fa-f]{6}$',
    example: '#6B7280',
    description: 'Omitir para manter a cor actual; não aceita null nem vazio.',
  })
  @OptionalField()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @Matches(HEX_COLOR, { message: 'A cor deve estar no formato #RRGGBB' })
  secondaryColor?: string;

  @ApiPropertyOptional({
    type: String,
    pattern: '^#[0-9A-Fa-f]{6}$',
    example: '#F59E0B',
    description: 'Omitir para manter a cor actual; não aceita null nem vazio.',
  })
  @OptionalField()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @Matches(HEX_COLOR, { message: 'A cor deve estar no formato #RRGGBB' })
  accentColor?: string;

  @ApiPropertyOptional({
    type: String,
    pattern: '^#[0-9A-Fa-f]{6}$',
    example: '#FFFFFF',
    description: 'Omitir para manter a cor actual; não aceita null nem vazio.',
  })
  @OptionalField()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @Matches(HEX_COLOR, { message: 'A cor deve estar no formato #RRGGBB' })
  backgroundColor?: string;

  @ApiPropertyOptional({
    type: String,
    pattern: '^#[0-9A-Fa-f]{6}$',
    example: '#F9FAFB',
    description: 'Omitir para manter a cor actual; não aceita null nem vazio.',
  })
  @OptionalField()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @Matches(HEX_COLOR, { message: 'A cor deve estar no formato #RRGGBB' })
  surfaceColor?: string;

  @ApiPropertyOptional({
    type: String,
    pattern: '^#[0-9A-Fa-f]{6}$',
    example: '#111827',
    description: 'Omitir para manter a cor actual; não aceita null nem vazio.',
  })
  @OptionalField()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @Matches(HEX_COLOR, { message: 'A cor deve estar no formato #RRGGBB' })
  textColor?: string;

  @ApiPropertyOptional({ enum: ThemeMode, example: ThemeMode.LIGHT })
  @OptionalField()
  @IsEnum(ThemeMode, { message: 'Tema inválido' })
  themeMode?: ThemeMode;

  @ApiPropertyOptional({
    type: String,
    enum: ALLOWED_FONT_FAMILIES,
    nullable: true,
    description: 'null ou vazio remove a fonte personalizada.',
  })
  @Transform(({ value }: { value: unknown }) => emptyToNull(value))
  @IsOptional()
  @IsIn(ALLOWED_FONT_FAMILIES, { message: 'Fonte não permitida' })
  fontFamily?: string | null;

  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 32, example: 12 })
  @OptionalField()
  @IsInt({ message: 'O raio deve ser um inteiro' })
  @Min(0, { message: 'O raio mínimo é 0' })
  @Max(32, { message: 'O raio máximo é 32' })
  borderRadius?: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 120,
    description: 'null ou vazio remove o valor.',
  })
  @Transform(({ value }: { value: unknown }) => emptyToNull(value))
  @IsOptional()
  @IsString({ message: 'O valor deve ser texto' })
  @MaxLength(120, { message: 'O máximo é 120 caracteres' })
  welcomeTitle?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 300,
    description: 'null ou vazio remove o valor.',
  })
  @Transform(({ value }: { value: unknown }) => emptyToNull(value))
  @IsOptional()
  @IsString({ message: 'O valor deve ser texto' })
  @MaxLength(300, { message: 'O máximo é 300 caracteres' })
  welcomeMessage?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 200,
    description: 'null ou vazio remove o valor.',
  })
  @Transform(({ value }: { value: unknown }) => emptyToNull(value))
  @IsOptional()
  @IsString({ message: 'O valor deve ser texto' })
  @MaxLength(200, { message: 'O máximo é 200 caracteres' })
  footerText?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 255,
    description: 'null ou vazio remove o valor.',
  })
  @Transform(({ value }: { value: unknown }) => emptyToNull(value))
  @IsOptional()
  @IsString({ message: 'O valor deve ser texto' })
  @IsUrl(
    {
      protocols: ['https'],
      require_protocol: true,
      require_valid_protocol: true,
    },
    { message: 'A URL deve usar https' },
  )
  @MaxLength(255, { message: 'O máximo é 255 caracteres' })
  instagramUrl?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 255,
    description: 'null ou vazio remove o valor.',
  })
  @Transform(({ value }: { value: unknown }) => emptyToNull(value))
  @IsOptional()
  @IsString({ message: 'O valor deve ser texto' })
  @IsUrl(
    {
      protocols: ['https'],
      require_protocol: true,
      require_valid_protocol: true,
    },
    { message: 'A URL deve usar https' },
  )
  @MaxLength(255, { message: 'O máximo é 255 caracteres' })
  facebookUrl?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 255,
    description: 'null ou vazio remove o valor.',
  })
  @Transform(({ value }: { value: unknown }) => emptyToNull(value))
  @IsOptional()
  @IsString({ message: 'O valor deve ser texto' })
  @IsUrl(
    {
      protocols: ['https'],
      require_protocol: true,
      require_valid_protocol: true,
    },
    { message: 'A URL deve usar https' },
  )
  @MaxLength(255, { message: 'O máximo é 255 caracteres' })
  websiteUrl?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 30,
    description: 'null ou vazio remove o valor.',
  })
  @Transform(({ value }: { value: unknown }) => emptyToNull(value))
  @IsOptional()
  @IsString({ message: 'O valor deve ser texto' })
  @MaxLength(30, { message: 'O máximo é 30 caracteres' })
  whatsapp?: string | null;
}
