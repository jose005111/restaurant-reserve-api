import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryDeepPartialEntity, Repository } from 'typeorm';
import { BrandingAsset } from '../../common/enums/branding-asset.enum';
import {
  convertImageToWebp,
  detectImageMime,
} from '../../common/utils/image.util';
import { storageConfig } from '../../config';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { RestaurantAvailabilityService } from '../restaurants/restaurant-availability.service';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { STORAGE_SERVICE } from '../storage/storage.interface';
import type { StorageService } from '../storage/storage.interface';
import { BrandingResponseDto } from './dto/branding-response.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { RestaurantBranding } from './entities/restaurant-branding.entity';

const ASSET_COLUMNS = {
  [BrandingAsset.LOGO]: 'logoUrl',
  [BrandingAsset.LOGO_DARK]: 'logoDarkUrl',
  [BrandingAsset.FAVICON]: 'faviconUrl',
  [BrandingAsset.BANNER]: 'bannerUrl',
  [BrandingAsset.LOGIN_IMAGE]: 'loginImageUrl',
} as const;

@Injectable()
export class BrandingService {
  constructor(
    @InjectRepository(RestaurantBranding)
    private readonly brandings: Repository<RestaurantBranding>,
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    @Inject(STORAGE_SERVICE)
    private readonly storage: StorageService,
    @Inject(storageConfig.KEY)
    private readonly storageOptions: ConfigType<typeof storageConfig>,
    private readonly availability: RestaurantAvailabilityService,
  ) {}

  async getForUser(currentUser: AuthUser): Promise<BrandingResponseDto> {
    const restaurantId = this.requireRestaurantId(currentUser);
    const branding = await this.getOrCreateEntity(restaurantId);
    return this.toResponse(branding);
  }

  async update(
    currentUser: AuthUser,
    dto: UpdateBrandingDto,
  ): Promise<BrandingResponseDto> {
    const restaurantId = this.requireRestaurantId(currentUser);
    await this.getOrCreateEntity(restaurantId);

    const changes: QueryDeepPartialEntity<RestaurantBranding> = {};
    const target = changes as Record<string, unknown>;

    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        target[key] = value;
      }
    }

    if (Object.keys(changes).length > 0) {
      await this.brandings.update(restaurantId, changes);
    }

    const updated = await this.getOrCreateEntity(restaurantId);
    return this.toResponse(updated);
  }

  async getPublic(slug: string): Promise<BrandingResponseDto> {
    const restaurant = await this.restaurants.findOne({ where: { slug } });

    if (!restaurant) {
      throw new NotFoundException('Restaurante não encontrado');
    }

    await this.availability.assertAvailable(restaurant.id);
    const branding = await this.getOrCreateEntity(restaurant.id);

    return this.toResponse(branding);
  }

  async uploadAsset(
    currentUser: AuthUser,
    asset: BrandingAsset,
    file: Express.Multer.File | undefined,
  ): Promise<BrandingResponseDto> {
    if (!file) {
      throw new BadRequestException('Ficheiro é obrigatório');
    }

    const restaurantId = this.requireRestaurantId(currentUser);
    const branding = await this.getOrCreateEntity(restaurantId);
    this.validateImage(file);

    let converted: Buffer;

    try {
      converted = await convertImageToWebp(file.buffer);
    } catch {
      throw new BadRequestException('Imagem inválida');
    }

    const column = ASSET_COLUMNS[asset];
    const key = `restaurants/${restaurantId}/branding/${asset}-${Date.now()}.webp`;
    const stored = await this.storage.save(key, converted, 'image/webp');
    const previousUrl = branding[column];

    try {
      const changes = {
        [column]: stored.url,
      } as QueryDeepPartialEntity<RestaurantBranding>;
      await this.brandings.update(restaurantId, changes);
    } catch (error) {
      await this.storage.delete(stored.url);
      throw error;
    }

    if (previousUrl) {
      await this.storage.delete(previousUrl);
    }

    return this.getForUser(currentUser);
  }

  async removeAsset(
    currentUser: AuthUser,
    asset: BrandingAsset,
  ): Promise<void> {
    const restaurantId = this.requireRestaurantId(currentUser);
    const branding = await this.getOrCreateEntity(restaurantId);
    const column = ASSET_COLUMNS[asset];
    const previousUrl = branding[column];

    if (!previousUrl) {
      return;
    }

    const changes = {
      [column]: null,
    } as QueryDeepPartialEntity<RestaurantBranding>;
    await this.brandings.update(restaurantId, changes);
    await this.storage.delete(previousUrl);
  }

  private async getOrCreateEntity(
    restaurantId: string,
  ): Promise<RestaurantBranding> {
    const branding = await this.brandings.findOne({
      where: { restaurantId },
    });

    if (branding) {
      return branding;
    }

    return this.brandings.save(this.brandings.create({ restaurantId }));
  }

  private validateImage(file: Express.Multer.File): void {
    if (file.size > this.storageOptions.maxUploadBytes) {
      throw new BadRequestException('Ficheiro demasiado grande');
    }

    if (!detectImageMime(file.buffer)) {
      throw new BadRequestException(
        'Apenas imagens JPEG, PNG ou WebP são permitidas',
      );
    }
  }

  private requireRestaurantId(currentUser: AuthUser): string {
    if (!currentUser.restaurantId) {
      throw new ForbiddenException('Restaurante indisponível');
    }

    return currentUser.restaurantId;
  }

  private toResponse(branding: RestaurantBranding): BrandingResponseDto {
    return {
      logoUrl: branding.logoUrl,
      logoDarkUrl: branding.logoDarkUrl,
      faviconUrl: branding.faviconUrl,
      bannerUrl: branding.bannerUrl,
      loginImageUrl: branding.loginImageUrl,
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      accentColor: branding.accentColor,
      backgroundColor: branding.backgroundColor,
      surfaceColor: branding.surfaceColor,
      textColor: branding.textColor,
      themeMode: branding.themeMode,
      fontFamily: branding.fontFamily,
      borderRadius: branding.borderRadius,
      welcomeTitle: branding.welcomeTitle,
      welcomeMessage: branding.welcomeMessage,
      footerText: branding.footerText,
      instagramUrl: branding.instagramUrl,
      facebookUrl: branding.facebookUrl,
      websiteUrl: branding.websiteUrl,
      whatsapp: branding.whatsapp,
      createdAt: branding.createdAt,
      updatedAt: branding.updatedAt,
    };
  }
}
