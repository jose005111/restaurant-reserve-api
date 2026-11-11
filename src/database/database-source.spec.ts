import { ConnectionMetadataBuilder } from 'typeorm/connection/ConnectionMetadataBuilder';
import dataSource from './database-source';

jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('@nestjs/config', () => ({
  registerAs: (_name: string, factory: () => unknown) => factory,
}));

describe('migration data source', () => {
  it('discovers every schema migration without enabling synchronization', async () => {
    expect(dataSource.options.type).toBe('postgres');
    expect(dataSource.options.synchronize).toBe(false);

    const migrations = await new ConnectionMetadataBuilder(
      dataSource,
    ).buildMigrations(dataSource.options.migrations ?? []);
    const names = migrations.map((migration) => migration.name).sort();

    expect(names).toEqual([
      'CreateCategoriesAndMenu1762500000040',
      'CreateDiningTables1762500000030',
      'CreateEnums1762500000000',
      'CreateOrderCounters1762500000050',
      'CreateOrderItems1762500000070',
      'CreateOrderStatusHistory1762500000080',
      'CreateOrders1762500000060',
      'CreateRestaurantsAndBranding1762500000010',
      'CreateTriggers1762500000100',
      'CreateUsers1762500000020',
      'CreateWaiterCalls1762500000090',
    ]);
  });
});
