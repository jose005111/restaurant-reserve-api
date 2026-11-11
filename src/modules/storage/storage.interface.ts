export interface StoredFile {
  key: string;
  url: string;
}

export interface StorageService {
  save(key: string, buffer: Buffer, mimeType: string): Promise<StoredFile>;
  delete(url: string): Promise<void>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
