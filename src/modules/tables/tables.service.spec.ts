import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { appConfig } from '../../config';
import { DiningTable } from './entities/dining-table.entity';
import { TablesService } from './tables.service';

const user = {
  id: 'admin-a',
  name: 'Admin',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
  restaurantId: 'tenant-a',
};

describe('Tables tenant boundaries and limits', () => {
  it('hides another restaurant table on read, update, delete and QR operations', async () => {
    const repository = {
      findOne: jest
        .fn<() => Promise<Partial<DiningTable> | null>>()
        .mockResolvedValue({ id: 'table-b', restaurantId: 'tenant-b' }),
    };
    const service = new TablesService(
      repository as unknown as Repository<DiningTable>,
      { publicMenuBaseUrl: 'https://menu.example.com' } as ConfigType<
        typeof appConfig
      >,
      {} as DataSource,
    );
    for (const operation of [
      () => service.findOne(user, 'table-b'),
      () => service.update(user, 'table-b', { label: 'Changed' }),
      () => service.remove(user, 'table-b'),
      () => service.rotateToken(user, 'table-b'),
      () => service.getQr(user, 'table-b'),
    ]) {
      await expect(operation()).rejects.toBeInstanceOf(NotFoundException);
    }
  });

  it('rejects a new table at the plan limit while locking the restaurant row', async () => {
    const manager = {
      findOne: jest
        .fn<() => Promise<{ id: string; maxTables: number } | null>>()
        .mockResolvedValue({ id: 'tenant-a', maxTables: 1 }),
      count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
      save: jest.fn(),
    };
    const transaction = jest.fn(
      async (callback: (value: typeof manager) => Promise<DiningTable>) =>
        callback(manager),
    );
    const service = new TablesService(
      {} as Repository<DiningTable>,
      {} as ConfigType<typeof appConfig>,
      { transaction } as unknown as DataSource,
    );
    await expect(
      service.create(user, { label: 'Mesa 2' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(manager.findOne).toHaveBeenCalledWith(expect.any(Function), {
      where: { id: 'tenant-a' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.save).not.toHaveBeenCalled();
  });
});
