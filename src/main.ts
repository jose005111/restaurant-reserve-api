import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { ConfigType } from '@nestjs/config';
import { AppModule } from './app.module';
import { appConfig, storageConfig } from './config';
import { setupApp } from './setup-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  const storage = app.get<ConfigType<typeof storageConfig>>(storageConfig.KEY);

  setupApp(app, {
    storageLocalPath: storage.localPath,
    corsOrigins: config.cors_origins.filter(Boolean),
  });

  await app.listen(config.port);
  console.log(`API Listening on port ${config.port}`);
  console.log(`Swagger run on ${await app.getUrl()}/api/docs`);
}
void bootstrap();
