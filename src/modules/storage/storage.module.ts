import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';
import { storageConfig } from '../../config';
import { LocalStorageService } from './local-storage.service';
import { STORAGE_SERVICE } from './storage.interface';

@Module({
  imports: [ConfigModule.forFeature(storageConfig)],
  providers: [
    {
      provide: STORAGE_SERVICE,
      inject: [storageConfig.KEY],
      useFactory: (config: ConfigType<typeof storageConfig>) => {
        if (config.driver !== 'local') {
          throw new Error(`Driver de armazenamento inválido: ${config.driver}`);
        }

        return new LocalStorageService({
          localPath: config.localPath,
          publicBaseUrl: config.publicBaseUrl,
        });
      },
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
