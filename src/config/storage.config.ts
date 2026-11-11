import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => {
  const port = Number(process.env.PORT ?? 3000);

  return {
    driver: process.env.STORAGE_DRIVER ?? 'local',
    localPath: process.env.STORAGE_LOCAL_PATH ?? 'uploads',
    publicBaseUrl: (
      process.env.STORAGE_PUBLIC_BASE_URL ?? `http://localhost:${port}/uploads`
    ).replace(/\/+$/, ''),
    maxMenuItemImages: Number(process.env.MAX_MENU_ITEM_IMAGES ?? 5),
    maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 2 * 1024 * 1024),
  };
});
