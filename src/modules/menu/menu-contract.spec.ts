import { jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import sharp from 'sharp';
import { DataSource, Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { storageConfig } from '../../config';
import { Category } from '../categories/entities/category.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import type { StoredFile } from '../storage/storage.interface';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import {
  ReorderMenuImagesDto,
  UpdateMenuImageDto,
} from './dto/image-mutations.dto';
import { MenuItemImage } from './entities/menu-item-image.entity';
import { MenuItem } from './entities/menu-item.entity';
import { MenuImagesService } from './menu-images.service';
import { MenuItemsService } from './menu-items.service';

const user = {
  id: 'admin-id',
  restaurantId: 'tenant-id',
  name: 'Admin',
  email: 'test@example.com',
  role: UserRole.ADMIN,
};

describe('Menu contract and transaction safeguards', () => {
  it.each([-1, 1.5, 2147483648, null])(
    'rejects a price that cannot be stored as cents: %s',
    async (priceCents) => {
      expect(
        await validate(
          plainToInstance(CreateMenuItemDto, {
            categoryId: 'b67f8192-3d71-466f-9208-af275a65b503',
            name: 'Calulu',
            priceCents,
          }),
        ),
      ).not.toHaveLength(0);
    },
  );

  it('rejects null in required columns but normalizes an empty description', async () => {
    for (const field of [
      'categoryId',
      'name',
      'priceCents',
      'isAvailable',
      'sortOrder',
    ])
      expect(
        await validate(plainToInstance(UpdateMenuItemDto, { [field]: null })),
      ).not.toHaveLength(0);
    const dto = plainToInstance(UpdateMenuItemDto, {
      description: '  ',
      priceCents: 0,
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.description).toBeNull();
    expect(dto.priceCents).toBe(0);
  });

  it('rejects duplicate reorder IDs and null primary flags', async () => {
    const id = 'b67f8192-3d71-466f-9208-af275a65b503';
    expect(
      await validate(
        plainToInstance(ReorderMenuImagesDto, { imageIds: [id, id] }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(plainToInstance(UpdateMenuImageDto, { isPrimary: null })),
    ).not.toHaveLength(0);
  });

  it('locks the restaurant and rejects creation at the plan limit without inserting', async () => {
    const manager = {
      findOne: jest.fn((target: unknown) =>
        Promise.resolve(
          target === Restaurant
            ? { id: user.restaurantId, maxMenuItems: 1 }
            : { id: 'category-id', restaurantId: user.restaurantId },
        ),
      ),
      count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
      save: jest.fn(),
    };
    const transaction = jest.fn(
      (callback: (value: typeof manager) => Promise<MenuItem>) =>
        callback(manager),
    );
    const service = new MenuItemsService(
      {} as Repository<MenuItem>,
      {} as Repository<MenuItemImage>,
      { transaction } as unknown as DataSource,
      {
        save: () => Promise.resolve({ key: '', url: '' }),
        delete: () => Promise.resolve(),
      },
    );
    await expect(
      service.create(user, {
        categoryId: 'category-id',
        name: 'Calulu',
        priceCents: 100,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(manager.findOne).toHaveBeenCalledWith(Restaurant, {
      where: { id: user.restaurantId },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.findOne).toHaveBeenCalledWith(Category, {
      where: { id: 'category-id', restaurantId: user.restaurantId },
    });
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('removes the newly stored file if the image transaction fails', async () => {
    const manager = {
      findOne: jest
        .fn<() => Promise<Partial<MenuItem>>>()
        .mockResolvedValue({ id: 'item-id', restaurantId: user.restaurantId }),
      find: jest.fn<() => Promise<MenuItemImage[]>>().mockResolvedValue([]),
      create: jest.fn(
        (target: typeof MenuItemImage, data: Partial<MenuItemImage>) =>
          Object.assign(new target(), data),
      ),
      save: jest
        .fn<() => Promise<MenuItemImage>>()
        .mockRejectedValue(new Error('image insert failed')),
    };
    const transaction = jest.fn(
      (callback: (value: typeof manager) => Promise<MenuItemImage>) =>
        callback(manager),
    );
    const storage = {
      save: jest
        .fn<
          (key: string, buffer: Buffer, mime: string) => Promise<StoredFile>
        >()
        .mockImplementation((key) =>
          Promise.resolve({ key, url: `https://files.example.com/${key}` }),
        ),
      delete: jest
        .fn<(url: string) => Promise<void>>()
        .mockResolvedValue(undefined),
    };
    const service = new MenuImagesService(
      { transaction } as unknown as DataSource,
      storage,
      { maxUploadBytes: 256, maxMenuItemImages: 2 } as ConfigType<
        typeof storageConfig
      >,
    );
    const buffer = await sharp({
      create: { width: 1, height: 1, channels: 3, background: '#000000' },
    })
      .png()
      .toBuffer();
    await expect(
      service.upload(user, 'item-id', {}, {
        buffer,
        size: buffer.length,
      } as Express.Multer.File),
    ).rejects.toThrow('image insert failed');
    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledWith(
      expect.stringContaining(
        `/restaurants/${user.restaurantId}/menu-items/item-id/`,
      ),
    );
    expect(manager.findOne).toHaveBeenCalledWith(MenuItem, {
      where: { id: 'item-id', restaurantId: user.restaurantId },
      lock: { mode: 'pessimistic_write' },
    });
  });
  it('selects the next primary before TypeORM clears the removed entity ID', async () => {
    const primary = Object.assign(new MenuItemImage(), {
      id: 'first-image',
      isPrimary: true,
      url: 'https://files.example.com/first.webp',
    });
    const next = Object.assign(new MenuItemImage(), {
      id: 'second-image',
      isPrimary: false,
    });
    const manager = {
      findOne: jest
        .fn<() => Promise<Partial<MenuItem>>>()
        .mockResolvedValue({ id: 'item-id', restaurantId: user.restaurantId }),
      find: jest
        .fn<() => Promise<MenuItemImage[]>>()
        .mockResolvedValue([primary, next]),
      remove: jest.fn((image: MenuItemImage) => {
        Object.assign(image, { id: undefined });
        return Promise.resolve();
      }),
      update: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
    const transaction = jest.fn(
      (callback: (value: typeof manager) => Promise<string>) =>
        callback(manager),
    );
    const storage = {
      save: () => Promise.resolve({ key: '', url: '' }),
      delete: jest
        .fn<(url: string) => Promise<void>>()
        .mockResolvedValue(undefined),
    };
    const service = new MenuImagesService(
      { transaction } as unknown as DataSource,
      storage,
      {} as ConfigType<typeof storageConfig>,
    );
    await service.remove(user, 'item-id', 'first-image');
    expect(manager.update).toHaveBeenCalledWith(
      MenuItemImage,
      {
        id: 'second-image',
        restaurantId: user.restaurantId,
        menuItemId: 'item-id',
      },
      { isPrimary: true },
    );
    expect(storage.delete).toHaveBeenCalledWith(
      'https://files.example.com/first.webp',
    );
  });
});
