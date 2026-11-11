import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrandingService } from '../branding/branding.service';
import { Category } from '../categories/entities/category.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { RestaurantAvailabilityService } from '../restaurants/restaurant-availability.service';
import { DiningTable } from '../tables/entities/dining-table.entity';
import {
  MenuLinkType,
  PublicMenuResponseDto,
} from './dto/public-menu-response.dto';
import { MenuItem } from './entities/menu-item.entity';
import { MenuItemImage } from './entities/menu-item-image.entity';
import { IMAGE_ORDER } from './menu-images.util';

@Injectable()
export class PublicMenuService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    @InjectRepository(DiningTable)
    private readonly tables: Repository<DiningTable>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(MenuItem) private readonly items: Repository<MenuItem>,
    @InjectRepository(MenuItemImage)
    private readonly images: Repository<MenuItemImage>,
    private readonly availability: RestaurantAvailabilityService,
    private readonly branding: BrandingService,
  ) {}

  async getMenu(token: string): Promise<PublicMenuResponseDto> {
    if (token.length < 24 || token.length > 64)
      throw new NotFoundException('Link não encontrado');
    let restaurant = await this.restaurants.findOne({
      where: { publicToken: token },
    });
    let table: DiningTable | null = null;
    let linkType = MenuLinkType.GENERIC;
    if (!restaurant) {
      table = await this.tables.findOne({ where: { qrToken: token } });
      if (!table || !table.isActive)
        throw new NotFoundException('Link não encontrado');
      restaurant = await this.availability.assertAvailable(table.restaurantId);
      linkType = MenuLinkType.TABLE;
    } else restaurant = await this.availability.assertAvailable(restaurant.id);
    const restaurantId = restaurant.id;
    const [categories, items, images, tables, branding] = await Promise.all([
      this.categories.find({
        where: { restaurantId, isActive: true },
        order: { sortOrder: 'ASC', createdAt: 'ASC', id: 'ASC' },
      }),
      this.items.find({
        where: { restaurantId, isAvailable: true },
        order: { sortOrder: 'ASC', createdAt: 'ASC', id: 'ASC' },
      }),
      this.images.find({ where: { restaurantId }, order: IMAGE_ORDER }),
      linkType === MenuLinkType.GENERIC
        ? this.tables.find({
            where: { restaurantId, isActive: true },
            order: { createdAt: 'ASC', id: 'ASC' },
          })
        : Promise.resolve([]),
      this.branding.getPublic(restaurant.slug),
    ]);
    return {
      linkType,
      restaurant: {
        name: restaurant.name,
        slug: restaurant.slug,
        currency: restaurant.currency,
        phone: restaurant.phone,
        address: restaurant.address,
      },
      branding,
      table: table ? { id: table.id, label: table.label } : null,
      tables: tables.map((entry) => ({ id: entry.id, label: entry.label })),
      categories: categories
        .map((category) => ({
          name: category.name,
          items: items
            .filter((item) => item.categoryId === category.id)
            .map((item) => ({
              id: item.id,
              name: item.name,
              description: item.description,
              priceCents: item.priceCents,
              images: images
                .filter((image) => image.menuItemId === item.id)
                .map((image) => ({
                  url: image.url,
                  altText: image.altText,
                  sortOrder: image.sortOrder,
                  isPrimary: image.isPrimary,
                })),
            })),
        }))
        .filter((category) => category.items.length > 0),
    };
  }
}
