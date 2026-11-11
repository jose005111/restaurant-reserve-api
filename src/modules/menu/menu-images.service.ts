import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { storageConfig } from '../../config';
import {
  convertImageToWebp,
  detectImageMime,
} from '../../common/utils/image.util';
import { requireRestaurantId } from '../../common/utils/tenant.util';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { STORAGE_SERVICE } from '../storage/storage.interface';
import type { StorageService } from '../storage/storage.interface';
import {
  ReorderMenuImagesDto,
  UpdateMenuImageDto,
  UploadMenuImageDto,
} from './dto/image-mutations.dto';
import { MenuItemImageResponseDto } from './dto/menu-item-response.dto';
import { MenuItemImage } from './entities/menu-item-image.entity';
import {
  IMAGE_ORDER,
  lockMenuItem,
  toMenuImageResponse,
} from './menu-images.util';

@Injectable()
export class MenuImagesService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    @Inject(storageConfig.KEY)
    private readonly config: ConfigType<typeof storageConfig>,
  ) {}

  async upload(
    user: AuthUser,
    id: string,
    dto: UploadMenuImageDto,
    file: Express.Multer.File | undefined,
  ): Promise<MenuItemImageResponseDto> {
    const restaurantId = requireRestaurantId(user);
    if (!file) throw new BadRequestException('Ficheiro é obrigatório');
    if (file.size > this.config.maxUploadBytes)
      throw new PayloadTooLargeException('Ficheiro demasiado grande');
    if (!detectImageMime(file.buffer))
      throw new BadRequestException(
        'Apenas imagens JPEG, PNG ou WebP são permitidas',
      );
    let buffer: Buffer;
    try {
      buffer = await convertImageToWebp(file.buffer);
    } catch {
      throw new BadRequestException('Imagem inválida');
    }
    let storedUrl: string | undefined;
    try {
      const image = await this.dataSource.transaction(async (manager) => {
        await lockMenuItem(manager, restaurantId, id);
        const images = await manager.find(MenuItemImage, {
          where: { restaurantId, menuItemId: id },
          order: IMAGE_ORDER,
        });
        if (images.length >= this.config.maxMenuItemImages)
          throw new ConflictException('Limite de imagens do prato atingido');
        const stored = await this.storage.save(
          `restaurants/${restaurantId}/menu-items/${id}/${randomUUID()}.webp`,
          buffer,
          'image/webp',
        );
        storedUrl = stored.url;
        return manager.save(
          manager.create(MenuItemImage, {
            restaurantId,
            menuItemId: id,
            url: stored.url,
            storageKey: stored.key,
            altText: dto.altText ?? null,
            sortOrder: images.length
              ? Math.max(...images.map((entry) => entry.sortOrder)) + 1
              : 0,
            isPrimary: images.length === 0,
          }),
        );
      });
      return toMenuImageResponse(image);
    } catch (error) {
      if (storedUrl) await this.storage.delete(storedUrl);
      throw error;
    }
  }

  async reorder(
    user: AuthUser,
    id: string,
    dto: ReorderMenuImagesDto,
  ): Promise<MenuItemImageResponseDto[]> {
    const restaurantId = requireRestaurantId(user);
    return this.dataSource.transaction(async (manager) => {
      await lockMenuItem(manager, restaurantId, id);
      const images = await manager.find(MenuItemImage, {
        where: { restaurantId, menuItemId: id },
      });
      const ids = new Set(images.map((image) => image.id));
      if (
        dto.imageIds.length !== ids.size ||
        new Set(dto.imageIds).size !== ids.size ||
        dto.imageIds.some((imageId) => !ids.has(imageId))
      )
        throw new BadRequestException(
          'Envie todas as imagens deste prato, sem repetições',
        );
      for (const [sortOrder, imageId] of dto.imageIds.entries())
        await manager.update(
          MenuItemImage,
          { id: imageId, restaurantId, menuItemId: id },
          { sortOrder },
        );
      return (
        await manager.find(MenuItemImage, {
          where: { restaurantId, menuItemId: id },
          order: IMAGE_ORDER,
        })
      ).map(toMenuImageResponse);
    });
  }

  async update(
    user: AuthUser,
    id: string,
    imageId: string,
    dto: UpdateMenuImageDto,
  ): Promise<MenuItemImageResponseDto> {
    const restaurantId = requireRestaurantId(user);
    return this.dataSource.transaction(async (manager) => {
      await lockMenuItem(manager, restaurantId, id);
      const image = await manager.findOne(MenuItemImage, {
        where: { id: imageId, restaurantId, menuItemId: id },
      });
      if (!image) throw new NotFoundException('Imagem não encontrada');
      if (dto.isPrimary === false && image.isPrimary)
        throw new ConflictException(
          'Escolha outra imagem principal antes de desmarcar esta',
        );
      if (dto.isPrimary === true) {
        // Clear the old primary before promotion to satisfy the partial unique index.
        await manager.update(
          MenuItemImage,
          { restaurantId, menuItemId: id },
          { isPrimary: false },
        );
        image.isPrimary = true;
      }
      if (dto.altText !== undefined) image.altText = dto.altText;
      return toMenuImageResponse(await manager.save(image));
    });
  }

  async remove(user: AuthUser, id: string, imageId: string): Promise<void> {
    const restaurantId = requireRestaurantId(user);
    const url = await this.dataSource.transaction(async (manager) => {
      await lockMenuItem(manager, restaurantId, id);
      const images = await manager.find(MenuItemImage, {
        where: { restaurantId, menuItemId: id },
        order: IMAGE_ORDER,
      });
      const image = images.find((entry) => entry.id === imageId);
      if (!image) throw new NotFoundException('Imagem não encontrada');
      const next = images.find((entry) => entry.id !== imageId);
      const wasPrimary = image.isPrimary;
      const imageUrl = image.url;
      // TypeORM clears the removed entity ID; select the successor beforehand.
      await manager.remove(image);
      if (wasPrimary && next)
        await manager.update(
          MenuItemImage,
          { id: next.id, restaurantId, menuItemId: id },
          { isPrimary: true },
        );
      return imageUrl;
    });
    await this.storage.delete(url);
  }
}
