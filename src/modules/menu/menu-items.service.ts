import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, ILike, In, Repository } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import { paginationMeta } from '../../common/dto/pagination.dto';
import { escapeLike } from '../../common/utils/search.util';
import { MenuItemPageDto } from './dto/menu-item-page.dto';
import { ListMenuItemsQueryDto } from './dto/list-menu-items-query.dto';
import { isForeignKeyViolation } from '../../common/utils/database-error.util';
import { requireRestaurantId } from '../../common/utils/tenant.util';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { Category } from '../categories/entities/category.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { STORAGE_SERVICE } from '../storage/storage.interface';
import type { StorageService } from '../storage/storage.interface';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { MenuItemResponseDto } from './dto/menu-item-response.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { UpdateAvailabilityDto } from './dto/image-mutations.dto';
import { MenuItemImage } from './entities/menu-item-image.entity';
import { MenuItem } from './entities/menu-item.entity';
import {
  IMAGE_ORDER,
  lockMenuItem,
  toMenuImageResponse,
} from './menu-images.util';

@Injectable()
export class MenuItemsService {
  constructor(
    @InjectRepository(MenuItem) private readonly items: Repository<MenuItem>,
    @InjectRepository(MenuItemImage)
    private readonly images: Repository<MenuItemImage>,
    private readonly dataSource: DataSource,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async findAll(
    user: AuthUser,
    query: ListMenuItemsQueryDto = new ListMenuItemsQueryDto(),
  ): Promise<MenuItemPageDto> {
    const restaurantId = requireRestaurantId(user);
    const { page, limit, search, categoryId, isAvailable } = query;
    const where: FindOptionsWhere<MenuItem> = { restaurantId };
    if (search) where.name = ILike(`%${escapeLike(search)}%`);
    if (categoryId !== undefined) where.categoryId = categoryId;
    if (isAvailable !== undefined) where.isAvailable = isAvailable;
    const [items, total] = await this.items.findAndCount({
      where,
      order: { sortOrder: 'ASC', createdAt: 'ASC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const images = items.length
      ? await this.images.find({
          where: { restaurantId, menuItemId: In(items.map((item) => item.id)) },
          order: IMAGE_ORDER,
        })
      : [];
    return {
      items: items.map((item) =>
        this.toResponse(
          item,
          images.filter((image) => image.menuItemId === item.id),
        ),
      ),
      meta: paginationMeta(total, page, limit),
    };
  }

  async findOne(user: AuthUser, id: string): Promise<MenuItemResponseDto> {
    const restaurantId = requireRestaurantId(user);
    const item = await this.items.findOne({ where: { id, restaurantId } });
    if (!item) throw new NotFoundException('Prato não encontrado');
    return this.toResponse(
      item,
      await this.images.find({
        where: { menuItemId: id, restaurantId },
        order: IMAGE_ORDER,
      }),
    );
  }

  async create(
    user: AuthUser,
    dto: CreateMenuItemDto,
  ): Promise<MenuItemResponseDto> {
    const restaurantId = requireRestaurantId(user);
    try {
      const item = await this.dataSource.transaction(async (manager) => {
        const restaurant = await manager.findOne(Restaurant, {
          where: { id: restaurantId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!restaurant)
          throw new NotFoundException('Restaurante não encontrado');
        await this.assertCategory(manager, restaurantId, dto.categoryId);
        if (
          (await manager.count(MenuItem, { where: { restaurantId } })) >=
          restaurant.maxMenuItems
        )
          throw new ConflictException('Limite de pratos do plano atingido');
        return manager.save(
          manager.create(MenuItem, {
            restaurantId,
            categoryId: dto.categoryId,
            name: dto.name,
            description: dto.description ?? null,
            priceCents: dto.priceCents,
            isAvailable: dto.isAvailable ?? true,
            sortOrder: dto.sortOrder ?? 0,
          }),
        );
      });
      return this.toResponse(item, []);
    } catch (error) {
      if (isForeignKeyViolation(error))
        throw new ConflictException('A categoria já não está disponível');
      throw error;
    }
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateMenuItemDto,
  ): Promise<MenuItemResponseDto> {
    const restaurantId = requireRestaurantId(user);
    try {
      await this.dataSource.transaction(async (manager) => {
        const item = await lockMenuItem(manager, restaurantId, id);
        if (dto.categoryId !== undefined) {
          await this.assertCategory(manager, restaurantId, dto.categoryId);
          item.categoryId = dto.categoryId;
        }
        if (dto.name !== undefined) item.name = dto.name;
        if (dto.description !== undefined) item.description = dto.description;
        if (dto.priceCents !== undefined) item.priceCents = dto.priceCents;
        if (dto.isAvailable !== undefined) item.isAvailable = dto.isAvailable;
        if (dto.sortOrder !== undefined) item.sortOrder = dto.sortOrder;
        await manager.save(item);
      });
    } catch (error) {
      if (isForeignKeyViolation(error))
        throw new ConflictException('A categoria já não está disponível');
      throw error;
    }
    return this.findOne(user, id);
  }

  updateAvailability(
    user: AuthUser,
    id: string,
    dto: UpdateAvailabilityDto,
  ): Promise<MenuItemResponseDto> {
    return this.update(user, id, dto);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const restaurantId = requireRestaurantId(user);
    let removedImages: MenuItemImage[];
    try {
      removedImages = await this.dataSource.transaction(async (manager) => {
        const item = await lockMenuItem(manager, restaurantId, id);
        const images = await manager.find(MenuItemImage, {
          where: { menuItemId: id, restaurantId },
        });
        await manager.remove(item);
        return images;
      });
    } catch (error) {
      if (isForeignKeyViolation(error))
        throw new ConflictException(
          'O prato tem pedidos associados; marque-o como indisponível',
        );
      throw error;
    }
    await Promise.all(
      removedImages.map((image) => this.storage.delete(image.url)),
    );
  }

  private async assertCategory(
    manager: EntityManager,
    restaurantId: string,
    id: string,
  ): Promise<void> {
    if (!(await manager.findOne(Category, { where: { id, restaurantId } })))
      throw new NotFoundException('Categoria não encontrada');
  }

  private toResponse(
    item: MenuItem,
    images: MenuItemImage[],
  ): MenuItemResponseDto {
    return {
      id: item.id,
      restaurantId: item.restaurantId,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      priceCents: item.priceCents,
      isAvailable: item.isAvailable,
      sortOrder: item.sortOrder,
      images: images.map(toMenuImageResponse),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
