import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ThemeMode } from '../../../common/enums/theme-mode.enum';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';

@Entity('restaurant_branding')
export class RestaurantBranding {
  @PrimaryColumn({ name: 'restaurant_id', type: 'uuid' })
  restaurantId: string;

  @OneToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: Restaurant;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  @Column({
    name: 'logo_dark_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  logoDarkUrl: string | null;

  @Column({
    name: 'favicon_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  faviconUrl: string | null;

  @Column({ name: 'banner_url', type: 'varchar', length: 500, nullable: true })
  bannerUrl: string | null;

  @Column({
    name: 'login_image_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  loginImageUrl: string | null;

  @Column({
    name: 'primary_color',
    type: 'char',
    length: 7,
    default: '#111827',
  })
  primaryColor: string;

  @Column({
    name: 'secondary_color',
    type: 'char',
    length: 7,
    default: '#6B7280',
  })
  secondaryColor: string;

  @Column({
    name: 'accent_color',
    type: 'char',
    length: 7,
    default: '#F59E0B',
  })
  accentColor: string;

  @Column({
    name: 'background_color',
    type: 'char',
    length: 7,
    default: '#FFFFFF',
  })
  backgroundColor: string;

  @Column({
    name: 'surface_color',
    type: 'char',
    length: 7,
    default: '#F9FAFB',
  })
  surfaceColor: string;

  @Column({ name: 'text_color', type: 'char', length: 7, default: '#111827' })
  textColor: string;

  @Column({
    name: 'theme_mode',
    type: 'enum',
    enum: ThemeMode,
    enumName: 'theme_mode',
    default: ThemeMode.LIGHT,
  })
  themeMode: ThemeMode;

  @Column({
    name: 'font_family',
    type: 'varchar',
    length: 60,
    nullable: true,
  })
  fontFamily: string | null;

  @Column({ name: 'border_radius', type: 'smallint', default: 12 })
  borderRadius: number;

  @Column({
    name: 'welcome_title',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  welcomeTitle: string | null;

  @Column({
    name: 'welcome_message',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  welcomeMessage: string | null;

  @Column({
    name: 'footer_text',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  footerText: string | null;

  @Column({
    name: 'instagram_url',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  instagramUrl: string | null;

  @Column({
    name: 'facebook_url',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  facebookUrl: string | null;

  @Column({
    name: 'website_url',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  websiteUrl: string | null;

  @Column({ name: 'whatsapp', type: 'varchar', length: 30, nullable: true })
  whatsapp: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
