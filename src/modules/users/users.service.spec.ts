import { jest } from '@jest/globals';
import { DataSource, Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

const platformAdmin: AuthUser = {
  id: 'super-id',
  name: 'Super',
  email: 'super@example.com',
  role: UserRole.SUPER_ADMIN,
  restaurantId: null,
};
const restaurantAdmin: AuthUser = {
  id: 'admin-id',
  name: 'Admin',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
  restaurantId: 'restaurant-a',
};

describe('Users management', () => {
  const users = {
    find: jest.fn<() => Promise<User[]>>().mockResolvedValue([]),
    findOne: jest.fn<() => Promise<User | null>>(),
    findOneOrFail: jest.fn<() => Promise<User>>(),
    update: jest.fn<() => Promise<object>>().mockResolvedValue({}),
  };
  const service = new UsersService(
    users as unknown as Repository<User>,
    {} as DataSource,
  );

  beforeEach(() => jest.clearAllMocks());

  it('filters the platform list by role, restaurant and activity', async () => {
    await service.findAll(platformAdmin, {
      role: UserRole.COUNTER,
      restaurantId: 'restaurant-a',
      isActive: 'false',
    });
    expect(users.find).toHaveBeenCalledWith({
      where: {
        role: UserRole.COUNTER,
        restaurantId: 'restaurant-a',
        isActive: false,
      },
      order: { createdAt: 'ASC' },
    });
  });

  it('keeps restaurant admins inside their tenant when filtering', async () => {
    await service.findAll(restaurantAdmin, { role: UserRole.COUNTER });
    expect(users.find).toHaveBeenCalledWith({
      where: { restaurantId: 'restaurant-a', role: UserRole.COUNTER },
      order: { createdAt: 'ASC' },
    });
    await expect(
      service.findAll(restaurantAdmin, { restaurantId: 'restaurant-b' }),
    ).rejects.toThrow('Acesso negado');
  });

  it('allows editing a super admin profile without changing its role or tenant', async () => {
    const account = {
      id: 'super-id',
      role: UserRole.SUPER_ADMIN,
      restaurantId: null,
      email: 'super@example.com',
    } as User;
    users.findOne.mockResolvedValue(account);
    users.findOneOrFail.mockResolvedValue({ ...account, name: 'New name' });
    await service.update(platformAdmin, 'super-id', { name: 'New name' });
    expect(users.update).toHaveBeenCalledWith('super-id', { name: 'New name' });
    await expect(
      service.update(platformAdmin, 'super-id', { isActive: false }),
    ).rejects.toThrow('Não é possível desactivar');
    await expect(
      service.update(platformAdmin, 'super-id', { role: UserRole.ADMIN }),
    ).rejects.toThrow('Não é possível alterar a função');
  });
});
