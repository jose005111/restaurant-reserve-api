import { jest } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, FindOperator, Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { CategoriesService } from '../categories/categories.service';
import { Category } from '../categories/entities/category.entity';
import { ListCategoriesQueryDto } from '../categories/dto/list-categories-query.dto';
import { ListMenuItemsQueryDto } from './dto/list-menu-items-query.dto';
import { MenuItem } from './entities/menu-item.entity';
import { MenuItemImage } from './entities/menu-item-image.entity';
import { MenuItemsService } from './menu-items.service';

const user = {
  id: 'admin',
  name: 'Admin',
  email: 'admin@example.com',
  restaurantId: 'tenant-a',
  role: UserRole.ADMIN,
};

describe('Database catalogue pagination', () => {
  it('validates defaults and parses false without implicit truthiness', async () => {
    const categories = plainToInstance(ListCategoriesQueryDto, {
      isActive: 'false',
      search: '  Calulu  ',
    });
    const items = plainToInstance(ListMenuItemsQueryDto, {
      page: '2',
      limit: '50',
      isAvailable: 'false',
    });
    expect(await validate(categories)).toHaveLength(0);
    expect(categories).toMatchObject({
      page: 1,
      limit: 20,
      isActive: false,
      search: 'Calulu',
    });
    expect(await validate(items)).toHaveLength(0);
    expect(items).toMatchObject({ page: 2, limit: 50, isAvailable: false });
    expect(
      plainToInstance(ListCategoriesQueryDto, { search: ' ' }).search,
    ).toBeUndefined();
  });

  it.each([
    { page: 0 },
    { page: 1.5 },
    { page: 'abc' },
    { page: 1000001 },
    { limit: 101 },
    { limit: 0 },
    { isAvailable: '0' },
    { categoryId: 'invalid' },
    { search: 'x'.repeat(101) },
  ])('rejects an invalid query: %j', async (input) => {
    expect(
      await validate(plainToInstance(ListMenuItemsQueryDto, input)),
    ).not.toHaveLength(0);
  });

  it('passes offset, limit and tenant/search/active filters to the category repository', async () => {
    const category = Object.assign(new Category(), {
      id: 'category-id',
      restaurantId: user.restaurantId,
      name: '100%_',
      isActive: false,
    });
    const findAndCount = jest
      .fn<(options: object) => Promise<[Category[], number]>>()
      .mockResolvedValue([[category], 3]);
    const service = new CategoriesService({
      findAndCount,
    } as unknown as Repository<Category>);
    const query = Object.assign(new ListCategoriesQueryDto(), {
      page: 2,
      limit: 2,
      search: '100%_',
      isActive: false,
    });
    const result = await service.findAll(user, query);
    const options = findAndCount.mock.calls[0][0] as {
      where: {
        restaurantId: string;
        name: FindOperator<string>;
        isActive: boolean;
      };
      skip: number;
      take: number;
      order: object;
    };
    expect(options).toMatchObject({
      where: { restaurantId: user.restaurantId, isActive: false },
      skip: 2,
      take: 2,
      order: { sortOrder: 'ASC', createdAt: 'ASC', id: 'ASC' },
    });
    expect(options.where.name.type).toBe('ilike');
    expect(options.where.name.value).toBe('%100\\%\\_%');
    expect(result.items.map((entry) => entry.id)).toEqual(['category-id']);
    expect(result.meta).toEqual({ total: 3, page: 2, limit: 2, totalPages: 2 });
  });

  it('fetches product images only for the database page and preserves the full filtered count', async () => {
    const item = Object.assign(new MenuItem(), {
      id: 'item-on-page',
      restaurantId: user.restaurantId,
      categoryId: 'category-id',
      name: 'Calulu',
    });
    const image = Object.assign(new MenuItemImage(), {
      id: 'image-id',
      menuItemId: item.id,
      url: '/image.webp',
    });
    const findAndCount = jest
      .fn<(options: object) => Promise<[MenuItem[], number]>>()
      .mockResolvedValue([[item], 4]);
    const findImages = jest
      .fn<(options: object) => Promise<MenuItemImage[]>>()
      .mockResolvedValue([image]);
    const service = new MenuItemsService(
      { findAndCount } as unknown as Repository<MenuItem>,
      { find: findImages } as unknown as Repository<MenuItemImage>,
      {} as DataSource,
      {
        save: () => Promise.resolve({ key: '', url: '' }),
        delete: () => Promise.resolve(),
      },
    );
    const result = await service.findAll(
      user,
      Object.assign(new ListMenuItemsQueryDto(), {
        page: 2,
        limit: 3,
        categoryId: 'category-id',
        isAvailable: false,
        search: 'calulu',
      }),
    );
    const options = findAndCount.mock.calls[0][0] as {
      where: {
        restaurantId: string;
        categoryId: string;
        isAvailable: boolean;
        name: FindOperator<string>;
      };
      skip: number;
      take: number;
    };
    expect(options).toMatchObject({
      where: {
        restaurantId: user.restaurantId,
        categoryId: 'category-id',
        isAvailable: false,
      },
      skip: 3,
      take: 3,
    });
    expect(options.where.name.value).toBe('%calulu%');
    const imageOptions = findImages.mock.calls[0][0] as {
      where: { restaurantId: string; menuItemId: FindOperator<string[]> };
    };
    expect(imageOptions.where.restaurantId).toBe(user.restaurantId);
    expect(imageOptions.where.menuItemId.value).toEqual(['item-on-page']);
    expect(result.items[0].images.map((entry) => entry.id)).toEqual([
      'image-id',
    ]);
    expect(result.meta).toEqual({ total: 4, page: 2, limit: 3, totalPages: 2 });
  });

  it('returns empty pages without reading all images', async () => {
    const findAndCount = jest
      .fn<() => Promise<[MenuItem[], number]>>()
      .mockResolvedValue([[], 0]);
    const findImages = jest.fn();
    const service = new MenuItemsService(
      { findAndCount } as unknown as Repository<MenuItem>,
      { find: findImages } as unknown as Repository<MenuItemImage>,
      {} as DataSource,
      {
        save: () => Promise.resolve({ key: '', url: '' }),
        delete: () => Promise.resolve(),
      },
    );
    const result = await service.findAll(
      user,
      Object.assign(new ListMenuItemsQueryDto(), { page: 8 }),
    );
    expect(result).toEqual({
      items: [],
      meta: { total: 0, page: 8, limit: 20, totalPages: 0 },
    });
    expect(findImages).not.toHaveBeenCalled();
  });
});
