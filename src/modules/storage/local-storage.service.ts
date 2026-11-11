import { Injectable, Logger } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, resolve, sep } from 'path';
import type { StorageService, StoredFile } from './storage.interface';

export interface LocalStorageOptions {
  localPath: string;
  publicBaseUrl: string;
}

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly basePath: string;

  constructor(private readonly options: LocalStorageOptions) {
    this.basePath = resolve(process.cwd(), options.localPath);
  }

  async save(key: string, buffer: Buffer): Promise<StoredFile> {
    const absolutePath = this.resolveSafePath(key);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);

    return {
      key,
      url: `${this.options.publicBaseUrl}/${key}`,
    };
  }

  async delete(url: string): Promise<void> {
    const key = this.keyFromUrl(url);

    if (!key) {
      return;
    }

    try {
      await unlink(this.resolveSafePath(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Falha ao remover ficheiro ${key}`);
      }
    }
  }

  private keyFromUrl(url: string): string | null {
    const prefix = `${this.options.publicBaseUrl}/`;

    if (url.startsWith(prefix)) {
      return url.slice(prefix.length);
    }

    return null;
  }

  private resolveSafePath(key: string): string {
    const absolutePath = resolve(this.basePath, key);

    if (
      absolutePath !== this.basePath &&
      !absolutePath.startsWith(`${this.basePath}${sep}`)
    ) {
      throw new Error('Caminho de armazenamento inválido');
    }

    return absolutePath;
  }
}
