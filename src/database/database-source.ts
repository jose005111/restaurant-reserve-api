import { config } from 'dotenv';

config({ path: '.env.dev' });
config({ path: '.env' });
import { databaseConfig } from '../config/index';
import { DataSource } from 'typeorm';
import { join } from 'path';

export default new DataSource({
  ...databaseConfig(),
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'migrations',
});
