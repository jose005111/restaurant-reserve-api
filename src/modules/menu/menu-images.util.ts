import { NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { MenuItemImageResponseDto } from './dto/menu-item-response.dto';
import { MenuItemImage } from './entities/menu-item-image.entity';
import { MenuItem } from './entities/menu-item.entity';

export const IMAGE_ORDER = {
  isPrimary: 'DESC',
  sortOrder: 'ASC',
  createdAt: 'ASC',
  id: 'ASC',
} as const;

export async function lockMenuItem(
  manager: EntityManager,
  restaurantId: string,
  id: string,
): Promise<MenuItem> {
  const item = await manager.findOne(MenuItem, {
    where: { id, restaurantId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!item) throw new NotFoundException('Prato não encontrado');
  return item;
}

export function toMenuImageResponse(
  image: MenuItemImage,
): MenuItemImageResponseDto {
  return {
    id: image.id,
    menuItemId: image.menuItemId,
    url: image.url,
    altText: image.altText,
    sortOrder: image.sortOrder,
    isPrimary: image.isPrimary,
    createdAt: image.createdAt,
  };
}
