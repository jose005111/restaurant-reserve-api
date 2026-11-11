import { jest } from '@jest/globals';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { RestaurantPlan } from '../../common/enums/restaurant-plan.enum';
import { RestaurantStatus } from '../../common/enums/restaurant-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../users/entities/user.entity';
import { DiningTable } from '../tables/entities/dining-table.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Order } from '../orders/entities/order.entity';
import { Restaurant } from './entities/restaurant.entity';
import { RestaurantsService } from './restaurants.service';

describe('Restaurant onboarding transaction', () => {
  const query = {
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn<() => Promise<User | null>>().mockResolvedValue(null),
  };
  const manager = {
    findOne: jest
      .fn<() => Promise<Restaurant | null>>()
      .mockResolvedValue(null),
    getRepository: jest
      .fn()
      .mockReturnValue({ createQueryBuilder: () => query }),
    create: jest.fn((target: typeof Restaurant | typeof User, data: object) =>
      Object.assign(new target(), data),
    ),
    save: jest.fn((entity: Restaurant | User) =>
      Promise.resolve(
        Object.assign(entity, {
          id: entity instanceof Restaurant ? 'restaurant-id' : 'admin-id',
        }),
      ),
    ),
  };
  const transaction = jest.fn(
    async (callback: (value: typeof manager) => Promise<Restaurant>) =>
      callback(manager),
  );
  const service = new RestaurantsService(
    {} as Repository<Restaurant>,
    { transaction } as unknown as DataSource,
  );
  const input = {
    name: 'Luanda Grill',
    admin: {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'test-password',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates the restaurant and first ADMIN together with SaaS defaults and a hashed password', async () => {
    const result = await service.create(input);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      name: 'Luanda Grill',
      slug: 'luanda-grill',
      currency: 'AOA',
      status: RestaurantStatus.ACTIVE,
      plan: RestaurantPlan.FREE,
      maxTables: 10,
      maxMenuItems: 50,
      maxUsers: 5,
      phone: null,
      address: null,
      subscriptionExpiresAt: null,
    });
    expect(result.publicToken).toMatch(/^[a-f0-9]{64}$/);
    const admin = manager.save.mock.calls
      .map(([entity]) => entity)
      .find((entity): entity is User => entity instanceof User);
    expect(admin).toMatchObject({
      restaurantId: 'restaurant-id',
      role: UserRole.ADMIN,
      isActive: true,
    });
    expect(
      await bcrypt.compare(input.admin.password, admin!.passwordHash),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain('password');
  });

  it('propagates a failed ADMIN insert through the transaction instead of reporting success', async () => {
    manager.save
      .mockImplementationOnce((entity) =>
        Promise.resolve(Object.assign(entity, { id: 'restaurant-id' })),
      )
      .mockRejectedValueOnce(new Error('admin insert failed'));
    await expect(service.create(input)).rejects.toThrow('admin insert failed');
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});

describe('Super admin restaurant activity', () => {
  const query = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn<() => Promise<object>>().mockResolvedValue({
      ordersCount30Days: '7',
      salesCents30Days: '25000',
      lastOrderAt: new Date('2026-11-10T10:00:00Z'),
    }),
  };
  const counts = new Map<unknown, number>([
    [DiningTable, 4],
    [MenuItem, 12],
    [User, 2],
  ]);
  const repositories = {
    findOne: jest
      .fn<() => Promise<Restaurant | null>>()
      .mockResolvedValue({ id: 'tenant-a' } as Restaurant),
  };
  const dataSource = {
    getRepository: jest.fn((entity: unknown) =>
      entity === Order
        ? { createQueryBuilder: () => query }
        : { count: jest.fn().mockResolvedValue(counts.get(entity)) },
    ),
  };
  const service = new RestaurantsService(
    repositories as unknown as Repository<Restaurant>,
    dataSource as unknown as DataSource,
  );

  beforeEach(() => jest.clearAllMocks());

  it('limits all activity to the requested restaurant and excludes unaccepted orders from sales', async () => {
    const result = await service.activity('tenant-a');
    expect(result).toMatchObject({
      restaurantId: 'tenant-a',
      tablesCount: 4,
      menuItemsCount: 12,
      activeUsersCount: 2,
      ordersCount30Days: 7,
      salesCents30Days: 25000,
    });
    expect(query.where).toHaveBeenCalledWith(
      'orders.restaurant_id = :id',
      expect.objectContaining({
        id: 'tenant-a',
        billableStatuses: ['ACCEPTED', 'PREPARING', 'READY', 'DELIVERED'],
      }),
    );
    expect(query.addSelect).toHaveBeenCalledWith(
      expect.stringContaining(
        'orders.created_at >= :since AND orders.status IN',
      ),
      'salesCents30Days',
    );
    expect(dataSource.getRepository).toHaveBeenCalledWith(Order);
  });

  it('rejects an unknown restaurant before reading activity', async () => {
    repositories.findOne.mockResolvedValueOnce(null);
    await expect(service.activity('unknown')).rejects.toThrow(
      'Restaurante não encontrado',
    );
    expect(dataSource.getRepository).not.toHaveBeenCalled();
  });
});
