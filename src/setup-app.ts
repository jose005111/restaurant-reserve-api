import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { resolve } from 'path';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

export function setupApp(
  app: NestExpressApplication,
  options: { storageLocalPath: string; corsOrigins: string[] },
) {
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.useStaticAssets(resolve(process.cwd(), options.storageLocalPath), {
    prefix: '/uploads',
  });
  app.enableCors({
    origin: options.corsOrigins.length ? options.corsOrigins : true,
    methods: ['POST', 'GET', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle('SaaS Restaurant Reserve API')
    .setDescription('API de pedidos por QR code para restaurantes')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });

  return document;
}
