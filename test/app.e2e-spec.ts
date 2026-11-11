import { OrdersModule } from '../src/modules/orders/orders.module';
import { ReportsModule } from '../src/modules/reports/reports.module';
import type { SummaryResponseDto } from '../src/modules/reports/dto/summary-response.dto';
import { Order } from '../src/modules/orders/entities/order.entity';
import { OrderStatus } from '../src/common/enums/order-status.enum';
import type {
  StaffOrderPageDto,
  StaffOrderResponseDto,
} from '../src/modules/orders/dto/staff-order.dto';
import { OrderItem } from '../src/modules/orders/entities/order-item.entity';
import type { CategoryPageDto } from '../src/modules/categories/dto/category-page.dto';
import type { MenuItemPageDto } from '../src/modules/menu/dto/menu-item-page.dto';
import { Category } from '../src/modules/categories/entities/category.entity';
import { CategoriesModule } from '../src/modules/categories/categories.module';
import { MenuItem } from '../src/modules/menu/entities/menu-item.entity';
import { MenuItemImage } from '../src/modules/menu/entities/menu-item-image.entity';
import { MenuModule } from '../src/modules/menu/menu.module';
import type { CategoryResponseDto } from '../src/modules/categories/dto/category-response.dto';
import type {
  MenuItemImageResponseDto,
  MenuItemResponseDto,
} from '../src/modules/menu/dto/menu-item-response.dto';
import type { PublicMenuResponseDto } from '../src/modules/menu/dto/public-menu-response.dto';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import type { OpenAPIObject } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import * as bcrypt from 'bcrypt';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { appConfig, storageConfig } from '../src/config';
import { SecurityModule } from '../src/common/security.module';
import { UserRole } from '../src/common/enums/user-role.enum';
import { RestaurantStatus } from '../src/common/enums/restaurant-status.enum';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { BrandingModule } from '../src/modules/branding/branding.module';
import { RestaurantBranding } from '../src/modules/branding/entities/restaurant-branding.entity';
import { HealthModule } from '../src/modules/health/health.module';
import { LinksModule } from '../src/modules/links/links.module';
import { Restaurant } from '../src/modules/restaurants/entities/restaurant.entity';
import { RestaurantsModule } from '../src/modules/restaurants/restaurants.module';
import { RestaurantsService } from '../src/modules/restaurants/restaurants.service';
import { DiningTable } from '../src/modules/tables/entities/dining-table.entity';
import { TablesModule } from '../src/modules/tables/tables.module';
import { UsersModule } from '../src/modules/users/users.module';
import { User } from '../src/modules/users/entities/user.entity';
import { setupApp } from '../src/setup-app';
import { MemoryDatabase } from './in-memory-database';
import type { RestaurantResponseDto } from '../src/modules/restaurants/dto/restaurant-response.dto';
import type { DiningTableResponseDto } from '../src/modules/tables/dto/dining-table-response.dto';
import type { BrandingResponseDto } from '../src/modules/branding/dto/branding-response.dto';

const TEST_SECRET = 'test-only-jwt-signing-key-with-32-characters';
const database = new MemoryDatabase();
function sseReader(response: Response) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  return async (expected: string): Promise<Record<string, unknown>> => {
    for (;;) {
      const end = buffer.indexOf('\n\n');
      if (end !== -1) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const event = frame
          .split('\n')
          .find((line) => line.startsWith('event:'))
          ?.slice(6)
          .trim();
        if (event !== expected) continue;
        const data = frame
          .split('\n')
          .find((line) => line.startsWith('data:'))
          ?.slice(5)
          .trim();
        return JSON.parse(data ?? '{}') as Record<string, unknown>;
      }
      const next = await reader.read();
      if (next.done) throw new Error(`SSE terminou antes de ${expected}`);
      buffer += decoder.decode(next.value, { stream: true });
    }
  };
}
const config = {
  maxPendingOrdersPerTable: 3,
  jwt: { secret: TEST_SECRET, expireIn: '1h' },
  allowPublicSignup: false,
  publicMenuBaseUrl: 'https://menu.example.com/m',
  cors_origins: [],
};

@Global()
@Module({
  providers: [
    { provide: DataSource, useValue: database },
    { provide: appConfig.KEY, useValue: config },
    {
      provide: ConfigService,
      useValue: {
        get: (key: string) => (key === 'JWT_SECRET' ? TEST_SECRET : undefined),
      },
    },
  ],
  exports: [DataSource, appConfig.KEY, ConfigService],
})
class TestInfrastructureModule {}

describe('Restaurant HTTP contracts (isolated repositories)', () => {
  let app: NestExpressApplication;
  let document: OpenAPIObject;
  let directory: string;
  let first: RestaurantResponseDto;
  let second: RestaurantResponseDto;
  let token: string;
  let otherToken: string;
  let superToken: string;
  let counterToken: string;
  let table: DiningTableResponseDto;
  let category: CategoryResponseDto;
  let item: MenuItemResponseDto;
  let otherCategory: CategoryResponseDto;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'restaurant-api-e2e-'));
    const builder = Test.createTestingModule({
      imports: [
        TestInfrastructureModule,
        SecurityModule,
        AuthModule,
        RestaurantsModule,
        UsersModule,
        TablesModule,
        LinksModule,
        BrandingModule,
        HealthModule,
        CategoriesModule,
        MenuModule,
        OrdersModule,
        ReportsModule,
      ],
    })
      .overrideProvider(appConfig.KEY)
      .useValue(config)
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) => (key === 'JWT_SECRET' ? TEST_SECRET : undefined),
      })
      .overrideProvider(storageConfig.KEY)
      .useValue({
        driver: 'local',
        localPath: directory,
        publicBaseUrl: 'http://localhost/uploads',
        maxUploadBytes: 256,
        maxMenuItemImages: 2,
      });
    for (const target of [
      Restaurant,
      RestaurantBranding,
      User,
      DiningTable,
      Category,
      MenuItem,
      MenuItemImage,
      Order,
      OrderItem,
    ]) {
      builder
        .overrideProvider(getRepositoryToken(target))
        .useValue(
          database.getRepository<
            | Restaurant
            | RestaurantBranding
            | User
            | DiningTable
            | Category
            | MenuItem
            | MenuItemImage
            | Order
            | OrderItem
          >(target),
        );
    }
    const module = await builder.compile();
    app = module.createNestApplication<NestExpressApplication>();
    document = setupApp(app, {
      storageLocalPath: directory,
      corsOrigins: ['https://staff.example.com'],
    });
    await app.init();

    const restaurants = app.get(RestaurantsService);
    first = await restaurants.create({
      name: 'First Restaurant',
      maxTables: 1,
      maxMenuItems: 4,
      maxUsers: 2,
      admin: {
        name: 'Admin A',
        email: 'admin-a@example.com',
        password: 'test-password-a',
      },
    });
    second = await restaurants.create({
      name: 'Second Restaurant',
      admin: {
        name: 'Admin B',
        email: 'admin-b@example.com',
        password: 'test-password-b',
      },
    });
    const auth = app.get(AuthService);
    token = (
      await auth.login({
        email: 'admin-a@example.com',
        password: 'test-password-a',
      })
    ).accessToken;
    otherToken = (
      await auth.login({
        email: 'admin-b@example.com',
        password: 'test-password-b',
      })
    ).accessToken;
    const superUser = await database.users.save(
      database.users.create({
        name: 'Platform Admin',
        email: 'platform@example.com',
        restaurantId: null,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        passwordHash: await bcrypt.hash('test-platform-password', 4),
      }),
    );
    const counter = await database.users.save(
      database.users.create({
        name: 'Counter',
        email: 'counter@example.com',
        restaurantId: first.id,
        role: UserRole.COUNTER,
        isActive: true,
        passwordHash: '',
      }),
    );
    superToken = app.get(JwtService).sign({ sub: superUser.id });
    counterToken = app.get(JwtService).sign({ sub: counter.id });
  });

  afterAll(async () => {
    await app?.close();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('exposes health, standardized auth errors and a typed current user', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect(({ body }: { body: { status: string } }) =>
        expect(body.status).toBe('ok'),
      );
    const denied = await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(401);
    expect(denied.body).toMatchObject({
      statusCode: 401,
      path: '/api/auth/me',
    });
    expect(typeof (denied.body as { timestamp: unknown }).timestamp).toBe(
      'string',
    );
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(me.body).toMatchObject({
      email: 'admin-a@example.com',
      restaurantId: first.id,
      role: UserRole.ADMIN,
    });
    expect(me.body).not.toHaveProperty('passwordHash');
  });

  it('creates restaurant and ADMIN through the SUPER_ADMIN endpoint with nullable defaults', async () => {
    await request(app.getHttpServer())
      .post('/api/restaurants')
      .auth(token, { type: 'bearer' })
      .send({})
      .expect(403);
    const response = await request(app.getHttpServer())
      .post('/api/restaurants')
      .auth(superToken, { type: 'bearer' })
      .send({
        name: 'Onboarded',
        slug: '',
        currency: '',
        phone: '',
        address: '',
        admin: {
          name: 'Owner',
          email: 'new-owner@example.com',
          password: 'test-new-password',
        },
      })
      .expect(201);
    const created = response.body as RestaurantResponseDto;
    expect(created).toMatchObject({
      slug: 'onboarded',
      currency: 'AOA',
      phone: null,
      address: null,
      maxTables: 10,
      maxMenuItems: 50,
      maxUsers: 5,
    });
    const branding = await request(app.getHttpServer())
      .get(`/api/public/branding/${created.slug}`)
      .expect(200);
    expect(branding.body).toMatchObject({
      primaryColor: '#111827',
      themeMode: 'LIGHT',
      borderRadius: 12,
      logoUrl: null,
      logoDarkUrl: null,
      faviconUrl: null,
      loginImageUrl: null,
      bannerUrl: null,
      fontFamily: null,
      welcomeTitle: null,
      welcomeMessage: null,
      footerText: null,
    });
    expect(branding.body).not.toHaveProperty('restaurantId');
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'new-owner@example.com', password: 'test-new-password' })
      .expect(200);
  });

  it('normalizes branding blanks, supports every style/text/contact and rejects invalid or unknown fields', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/branding')
      .auth(token, { type: 'bearer' })
      .send({
        primaryColor: '#123456',
        secondaryColor: '#234567',
        accentColor: '#345678',
        backgroundColor: '#456789',
        surfaceColor: '#567890',
        textColor: '#678901',
        themeMode: 'DARK',
        borderRadius: 0,
        fontFamily: 'Inter',
        welcomeTitle: ' Welcome ',
        welcomeMessage: ' Menu ',
        footerText: ' Footer ',
        instagramUrl: 'https://instagram.com/example',
        facebookUrl: 'https://facebook.com/example',
        websiteUrl: 'https://example.com',
        whatsapp: ' 244900000000 ',
      })
      .expect(200);
    expect(response.body).toMatchObject({
      primaryColor: '#123456',
      themeMode: 'DARK',
      borderRadius: 0,
      fontFamily: 'Inter',
      welcomeTitle: 'Welcome',
      whatsapp: '244900000000',
    });
    await request(app.getHttpServer())
      .patch('/api/branding')
      .auth(token, { type: 'bearer' })
      .send({ websiteUrl: '', fontFamily: ' ', welcomeTitle: null })
      .expect(200)
      .expect(({ body }: { body: BrandingResponseDto }) =>
        expect(body).toMatchObject({
          websiteUrl: null,
          fontFamily: null,
          welcomeTitle: null,
          primaryColor: '#123456',
        }),
      );
    for (const body of [
      { primaryColor: null },
      { primaryColor: '' },
      { themeMode: null },
      { borderRadius: null },
      { websiteUrl: 'http://example.com' },
      { logoUrl: 'https://example.com/logo.png' },
    ]) {
      await request(app.getHttpServer())
        .patch('/api/branding')
        .auth(token, { type: 'bearer' })
        .send(body)
        .expect(400);
    }
    await request(app.getHttpServer())
      .patch('/api/branding')
      .auth(counterToken, { type: 'bearer' })
      .send({ primaryColor: '#111111' })
      .expect(403);
  });

  it('keeps another tenant data inaccessible and applies table/user limits', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/tables')
      .auth(token, { type: 'bearer' })
      .send({ label: 'Mesa 1' })
      .expect(201);
    table = response.body as DiningTableResponseDto;
    await request(app.getHttpServer())
      .get(`/api/tables/${table.id}`)
      .auth(otherToken, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/tables/${table.id}`)
      .auth(otherToken, { type: 'bearer' })
      .send({ label: 'Other' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/tables/${table.id}`)
      .auth(otherToken, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/tables')
      .auth(token, { type: 'bearer' })
      .send({ label: 'Mesa 2' })
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/users')
      .auth(token, { type: 'bearer' })
      .send({
        name: 'Extra',
        email: 'extra@example.com',
        password: 'test-extra-password',
        role: 'COUNTER',
      })
      .expect(409);
    const otherAdmin = database.users.rows.find(
      (user) => user.restaurantId === second.id,
    )!;
    await request(app.getHttpServer())
      .get(`/api/users/${otherAdmin.id}`)
      .auth(token, { type: 'bearer' })
      .expect(404);
    const otherBranding = await request(app.getHttpServer())
      .get('/api/branding')
      .auth(otherToken, { type: 'bearer' })
      .expect(200);
    expect(otherBranding.body).toMatchObject({
      primaryColor: '#111827',
      themeMode: 'LIGHT',
    });
  });

  it('returns QR PNGs and persists rotated tokens with documented HTTP 200', async () => {
    const qr = await request(app.getHttpServer())
      .get(`/api/tables/${table.id}/qr`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(qr.body).toMatchObject({
      url: `https://menu.example.com/m/${table.qrToken}`,
    });
    expect((qr.body as { qrCode: string }).qrCode).toMatch(
      /^data:image\/png;base64,/,
    );
    const rotated = await request(app.getHttpServer())
      .post(`/api/tables/${table.id}/qr/rotate`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect((rotated.body as DiningTableResponseDto).qrToken).not.toBe(
      table.qrToken,
    );
    const generic = await request(app.getHttpServer())
      .get('/api/links/generic')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect((generic.body as { url: string }).url).toBe(
      `https://menu.example.com/m/${first.publicToken}`,
    );
    const newGeneric = await request(app.getHttpServer())
      .post('/api/links/generic/rotate')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect((newGeneric.body as { url: string }).url).not.toBe(
      (generic.body as { url: string }).url,
    );
  }, 60_000);

  it('validates actual images, caps multipart bytes and serves all five assets from the configured directory', async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#ff0000' },
    })
      .png()
      .toBuffer();
    const assets = {
      logo: 'logoUrl',
      'logo-dark': 'logoDarkUrl',
      favicon: 'faviconUrl',
      banner: 'bannerUrl',
      'login-image': 'loginImageUrl',
    } as const;
    for (const [asset, key] of Object.entries(assets)) {
      const response = await request(app.getHttpServer())
        .put(`/api/branding/${asset}`)
        .auth(token, { type: 'bearer' })
        .attach('file', png, {
          filename: 'image.png',
          contentType: 'application/octet-stream',
        })
        .expect(200);
      const url = (response.body as BrandingResponseDto)[key]!;
      expect(url).toMatch(/-[a-f0-9-]{36}\.webp$/);
      await request(app.getHttpServer())
        .get(new URL(url).pathname)
        .expect(200)
        .expect('Content-Type', /image\/webp/);
      await request(app.getHttpServer())
        .delete(`/api/branding/${asset}`)
        .auth(token, { type: 'bearer' })
        .expect(204);
      await request(app.getHttpServer()).get(new URL(url).pathname).expect(404);
    }
    await request(app.getHttpServer())
      .put('/api/branding/logo')
      .auth(token, { type: 'bearer' })
      .attach('file', Buffer.from('invalid'), 'fake.png')
      .expect(400);
    await request(app.getHttpServer())
      .put('/api/branding/logo')
      .auth(token, { type: 'bearer' })
      .attach('file', Buffer.alloc(257), 'large.png')
      .expect(413)
      .expect(({ body }: { body: { message: string } }) =>
        expect(body.message).toBe('Ficheiro demasiado grande'),
      );
  });

  it('blocks login, staff and public access when a restaurant is suspended or expired', async () => {
    for (const changes of [
      { status: RestaurantStatus.SUSPENDED },
      { status: RestaurantStatus.ACTIVE, subscriptionExpiresAt: new Date(0) },
    ]) {
      await database.restaurants.update(first.id, changes);
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin-a@example.com', password: 'test-password-a' })
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/branding')
        .auth(token, { type: 'bearer' })
        .expect(403);
      await request(app.getHttpServer())
        .get(`/api/public/branding/${first.slug}`)
        .expect(403);
    }
    await database.restaurants.update(first.id, {
      status: RestaurantStatus.ACTIVE,
      subscriptionExpiresAt: null,
    });
    await request(app.getHttpServer())
      .post('/api/public/signup')
      .send({
        name: 'Disabled',
        admin: {
          name: 'Owner',
          email: 'disabled@example.com',
          password: 'test-password',
        },
      })
      .expect(404);
  });

  it('creates categories and dishes with integer prices, tenant isolation and plan limits', async () => {
    const createCategory = async (
      name: string,
      body: object = {},
      access = token,
    ) => {
      const response = await request(app.getHttpServer())
        .post('/api/categories')
        .auth(access, { type: 'bearer' })
        .send({ name, ...body })
        .expect(201);
      return response.body as CategoryResponseDto;
    };
    category = await createCategory('Pratos', { sortOrder: 2 });
    const inactive = await createCategory('Oculta', {
      isActive: false,
      sortOrder: 0,
    });
    await createCategory('Vazia', { sortOrder: 1 });
    const unavailableCategory = await createCategory('Indisponíveis');
    otherCategory = await createCategory('Outro restaurante', {}, otherToken);
    await request(app.getHttpServer())
      .post('/api/menu-items')
      .auth(otherToken, { type: 'bearer' })
      .send({
        categoryId: otherCategory.id,
        name: 'Outro menu',
        priceCents: 999999,
      })
      .expect(201);
    const temporary = await createCategory('Temporária');
    await request(app.getHttpServer())
      .get(`/api/categories/${temporary.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/categories/${temporary.id}`)
      .auth(token, { type: 'bearer' })
      .send({ name: 'Renomeada', sortOrder: 1, isActive: false })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/categories/${temporary.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/categories')
      .auth(token, { type: 'bearer' })
      .send({ name: 'Pratos' })
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/categories')
      .auth(counterToken, { type: 'bearer' })
      .send({ name: 'Proibida' })
      .expect(403);
    for (const method of ['get', 'patch', 'delete'] as const) {
      await request(app.getHttpServer())
        [method](`/api/categories/${otherCategory.id}`)
        .auth(token, { type: 'bearer' })
        .send(method === 'patch' ? { name: 'Change' } : undefined)
        .expect(404);
    }
    await request(app.getHttpServer())
      .post('/api/menu-items')
      .auth(token, { type: 'bearer' })
      .send({ categoryId: otherCategory.id, name: 'Foreign', priceCents: 100 })
      .expect(404);
    for (const priceCents of [-1, 1.5, null, 2147483648]) {
      await request(app.getHttpServer())
        .post('/api/menu-items')
        .auth(token, { type: 'bearer' })
        .send({ categoryId: category.id, name: 'Invalid', priceCents })
        .expect(400);
    }
    const created = await request(app.getHttpServer())
      .post('/api/menu-items')
      .auth(token, { type: 'bearer' })
      .send({
        categoryId: category.id,
        name: ' Calulu ',
        description: ' ',
        priceCents: 250000,
        sortOrder: 20,
      })
      .expect(201);
    item = created.body as MenuItemResponseDto;
    await request(app.getHttpServer())
      .patch(`/api/menu-items/${item.id}`)
      .auth(token, { type: 'bearer' })
      .send({
        name: ' Calulu ',
        description: 'Receita tradicional',
        priceCents: 250000,
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/menu-items/${item.id}`)
      .auth(token, { type: 'bearer' })
      .send({ description: '' })
      .expect(200);
    expect(item).toMatchObject({
      name: 'Calulu',
      description: null,
      priceCents: 250000,
      isAvailable: true,
      images: [],
    });
    for (const body of [
      { categoryId: category.id, name: 'Funge', sortOrder: 10 },
      { categoryId: inactive.id, name: 'Oculto' },
      {
        categoryId: unavailableCategory.id,
        name: 'Esgotado',
        isAvailable: false,
      },
    ]) {
      await request(app.getHttpServer())
        .post('/api/menu-items')
        .auth(token, { type: 'bearer' })
        .send({ priceCents: 10000, ...body })
        .expect(201);
    }
    await request(app.getHttpServer())
      .post('/api/menu-items')
      .auth(token, { type: 'bearer' })
      .send({ categoryId: category.id, name: 'Excess', priceCents: 1 })
      .expect(409);
    await request(app.getHttpServer())
      .get(`/api/menu-items/${item.id}`)
      .auth(otherToken, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/menu-items/${item.id}`)
      .auth(otherToken, { type: 'bearer' })
      .send({ name: 'Stolen' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/menu-items/${item.id}`)
      .auth(otherToken, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/menu-items/${item.id}`)
      .auth(token, { type: 'bearer' })
      .send({ categoryId: otherCategory.id })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/categories/${category.id}`)
      .auth(token, { type: 'bearer' })
      .expect(409);
    const listing = await request(app.getHttpServer())
      .get('/api/menu-items')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(
      (listing.body as MenuItemPageDto).items.every(
        (entry) => entry.restaurantId === first.id,
      ),
    ).toBe(true);
    await request(app.getHttpServer())
      .patch(`/api/menu-items/${item.id}/availability`)
      .auth(counterToken, { type: 'bearer' })
      .send({ isAvailable: false })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/menu-items/${item.id}`)
      .auth(counterToken, { type: 'bearer' })
      .send({ name: 'Denied' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/menu-items/${item.id}/availability`)
      .auth(counterToken, { type: 'bearer' })
      .send({ isAvailable: true })
      .expect(200);
  });

  it('resolves TABLE and GENERIC tokens, filters the public menu and invalidates rotated tokens', async () => {
    const restaurant = await database.restaurants.findOneOrFail({
      where: { id: first.id },
    });
    const currentTable = await database.tables.findOneOrFail({
      where: { id: table.id },
    });
    const response = await request(app.getHttpServer())
      .get(`/api/public/menu/${restaurant.publicToken}`)
      .expect(200);
    const menu = response.body as PublicMenuResponseDto;
    expect(menu).toMatchObject({
      linkType: 'GENERIC',
      table: null,
      tables: [{ id: table.id, label: 'Mesa 1' }],
      restaurant: { name: first.name, currency: 'AOA' },
    });
    expect(menu.categories.map((entry) => entry.name)).toEqual(['Pratos']);
    expect(menu.categories[0].items.map((entry) => entry.name)).toEqual([
      'Funge',
      'Calulu',
    ]);
    expect(menu.branding).toHaveProperty('primaryColor');
    expect(menu.restaurant).not.toHaveProperty('id');
    expect(menu.restaurant).not.toHaveProperty('publicToken');
    expect(menu.categories[0]).not.toHaveProperty('restaurantId');
    const tableMenu = await request(app.getHttpServer())
      .get(`/api/public/menu/${currentTable.qrToken}`)
      .expect(200);
    expect(tableMenu.body).toMatchObject({
      linkType: 'TABLE',
      table: { id: table.id },
      tables: [],
    });
    await request(app.getHttpServer())
      .get(`/api/public/menu/${first.publicToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/public/menu/${table.qrToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/public/menu/${'f'.repeat(64)}`)
      .expect(404);
    await database.tables.update(table.id, { isActive: false });
    await request(app.getHttpServer())
      .get(`/api/public/menu/${currentTable.qrToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/public/menu/${restaurant.publicToken}`)
      .expect(200)
      .expect(({ body }: { body: PublicMenuResponseDto }) =>
        expect(body.tables).toEqual([]),
      );
    await database.tables.update(table.id, { isActive: true });
    await database.restaurants.update(first.id, {
      status: RestaurantStatus.SUSPENDED,
    });
    await request(app.getHttpServer())
      .get(`/api/public/menu/${restaurant.publicToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/public/menu/${currentTable.qrToken}`)
      .expect(403);
    await database.restaurants.update(first.id, {
      status: RestaurantStatus.ACTIVE,
    });
  });

  it('paginates and filters categories with totals scoped to the authenticated tenant', async () => {
    const firstPage = await request(app.getHttpServer())
      .get('/api/categories?page=1&limit=2')
      .auth(token, { type: 'bearer' })
      .expect(200);
    const secondPage = await request(app.getHttpServer())
      .get('/api/categories?page=2&limit=2')
      .auth(token, { type: 'bearer' })
      .expect(200);
    const firstResult = firstPage.body as CategoryPageDto;
    const secondResult = secondPage.body as CategoryPageDto;
    expect(firstResult.meta).toEqual({
      total: 4,
      page: 1,
      limit: 2,
      totalPages: 2,
    });
    expect(secondResult.meta).toEqual({
      total: 4,
      page: 2,
      limit: 2,
      totalPages: 2,
    });
    const ids = [...firstResult.items, ...secondResult.items].map(
      (entry) => entry.id,
    );
    expect(new Set(ids).size).toBe(4);
    expect(ids).not.toContain(otherCategory.id);
    const inactive = await request(app.getHttpServer())
      .get('/api/categories?isActive=false&search=OCULTA')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(
      (inactive.body as CategoryPageDto).items.map((entry) => entry.name),
    ).toEqual(['Oculta']);
    expect((inactive.body as CategoryPageDto).meta.total).toBe(1);
    const beyond = await request(app.getHttpServer())
      .get('/api/categories?page=9&limit=2')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(beyond.body).toMatchObject({
      items: [],
      meta: { total: 4, page: 9, limit: 2, totalPages: 2 },
    });
    const literal = await request(app.getHttpServer())
      .get('/api/categories')
      .query({ search: '%' })
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(literal.body).toMatchObject({
      items: [],
      meta: { total: 0, totalPages: 0 },
    });
    const allIds: string[] = [];
    for (let page = 1; ; page++) {
      const response = await request(app.getHttpServer())
        .get('/api/categories')
        .query({ page, limit: 1 })
        .auth(token, { type: 'bearer' })
        .expect(200);
      const result = response.body as CategoryPageDto;
      allIds.push(...result.items.map((entry) => entry.id));
      if (page >= result.meta.totalPages) break;
    }
    expect(new Set(allIds)).toEqual(new Set(ids));
  });

  it('paginates products and combines search/category/availability without losing the total', async () => {
    const firstPage = await request(app.getHttpServer())
      .get('/api/menu-items?page=1&limit=2')
      .auth(token, { type: 'bearer' })
      .expect(200);
    const secondPage = await request(app.getHttpServer())
      .get('/api/menu-items?page=2&limit=2')
      .auth(token, { type: 'bearer' })
      .expect(200);
    const firstResult = firstPage.body as MenuItemPageDto;
    const secondResult = secondPage.body as MenuItemPageDto;
    expect(firstResult.meta).toEqual({
      total: 4,
      page: 1,
      limit: 2,
      totalPages: 2,
    });
    expect(secondResult.meta).toEqual({
      total: 4,
      page: 2,
      limit: 2,
      totalPages: 2,
    });
    expect(
      new Set(
        [...firstResult.items, ...secondResult.items].map((entry) => entry.id),
      ).size,
    ).toBe(4);
    const filtered = await request(app.getHttpServer())
      .get('/api/menu-items')
      .query({ categoryId: category.id, isAvailable: true, search: ' CALULU ' })
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(
      (filtered.body as MenuItemPageDto).items.map((entry) => entry.id),
    ).toEqual([item.id]);
    expect((filtered.body as MenuItemPageDto).meta.total).toBe(1);
    const unavailable = await request(app.getHttpServer())
      .get('/api/menu-items?isAvailable=false')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(
      (unavailable.body as MenuItemPageDto).items.map((entry) => entry.name),
    ).toEqual(['Esgotado']);
    const foreign = await request(app.getHttpServer())
      .get('/api/menu-items')
      .query({ categoryId: otherCategory.id })
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(foreign.body).toMatchObject({
      items: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
    });
    const beyond = await request(app.getHttpServer())
      .get('/api/menu-items?page=10&limit=2')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(beyond.body).toMatchObject({
      items: [],
      meta: { total: 4, page: 10, limit: 2, totalPages: 2 },
    });
  });

  it('rejects invalid pagination/filter query values instead of silently coercing or truncating', async () => {
    for (const route of ['/api/categories', '/api/menu-items']) {
      for (const query of [
        { page: 0 },
        { page: 'abc' },
        { page: 1.5 },
        { limit: 101 },
        { limit: 0 },
        { unknown: 'field' },
      ]) {
        await request(app.getHttpServer())
          .get(route)
          .query(query)
          .auth(token, { type: 'bearer' })
          .expect(400);
      }
    }
    await request(app.getHttpServer())
      .get('/api/categories?isActive=0')
      .auth(token, { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/menu-items?isAvailable=not-boolean')
      .auth(token, { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/menu-items?categoryId=invalid')
      .auth(token, { type: 'bearer' })
      .expect(400);
  });

  it('enforces image limits and one primary, reorders safely and promotes the next image on delete', async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#00ff00' },
    })
      .png()
      .toBuffer();
    const upload = async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/menu-items/${item.id}/images`)
        .auth(token, { type: 'bearer' })
        .field('altText', ' Calulu ')
        .attach('file', png, 'dish.png')
        .expect(201);
      return response.body as MenuItemImageResponseDto;
    };
    const firstImage = await upload();
    const secondImage = await upload();
    expect(firstImage).toMatchObject({
      isPrimary: true,
      sortOrder: 0,
      altText: 'Calulu',
    });
    expect(secondImage).toMatchObject({ isPrimary: false, sortOrder: 1 });
    expect(firstImage).not.toHaveProperty('storageKey');
    await request(app.getHttpServer())
      .post(`/api/menu-items/${item.id}/images`)
      .auth(token, { type: 'bearer' })
      .attach('file', png, 'excess.png')
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/menu-items/${item.id}/images`)
      .auth(token, { type: 'bearer' })
      .attach('file', Buffer.from('<svg/>'), 'fake.png')
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/menu-items/${item.id}/images`)
      .auth(token, { type: 'bearer' })
      .attach('file', Buffer.alloc(257), 'large.png')
      .expect(413);
    await request(app.getHttpServer())
      .post(`/api/menu-items/${item.id}/images`)
      .auth(otherToken, { type: 'bearer' })
      .attach('file', png, 'foreign.png')
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/menu-items/${item.id}/images/${secondImage.id}`)
      .auth(otherToken, { type: 'bearer' })
      .send({ isPrimary: true })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/menu-items/${item.id}/images/${secondImage.id}`)
      .auth(token, { type: 'bearer' })
      .send({ isPrimary: true, altText: '' })
      .expect(200);
    expect(
      database.images.rows.filter(
        (image) => image.menuItemId === item.id && image.isPrimary,
      ),
    ).toHaveLength(1);
    await request(app.getHttpServer())
      .patch(`/api/menu-items/${item.id}/images/${secondImage.id}`)
      .auth(token, { type: 'bearer' })
      .send({ isPrimary: false })
      .expect(409);
    for (const imageIds of [
      [firstImage.id],
      [firstImage.id, firstImage.id],
      [firstImage.id, otherCategory.id],
    ]) {
      await request(app.getHttpServer())
        .patch(`/api/menu-items/${item.id}/images/reorder`)
        .auth(token, { type: 'bearer' })
        .send({ imageIds })
        .expect(400);
    }
    const reordered = await request(app.getHttpServer())
      .patch(`/api/menu-items/${item.id}/images/reorder`)
      .auth(token, { type: 'bearer' })
      .send({ imageIds: [firstImage.id, secondImage.id] })
      .expect(200);
    expect(
      (reordered.body as MenuItemImageResponseDto[]).map((image) => image.id),
    ).toEqual([secondImage.id, firstImage.id]);
    const restaurant = await database.restaurants.findOneOrFail({
      where: { id: first.id },
    });
    const publicMenu = await request(app.getHttpServer())
      .get(`/api/public/menu/${restaurant.publicToken}`)
      .expect(200);
    const publicImages = (publicMenu.body as PublicMenuResponseDto).categories
      .flatMap((entry) => entry.items)
      .find((entry) => entry.id === item.id)!.images;
    expect(publicImages.map((image) => image.url)).toEqual([
      secondImage.url,
      firstImage.url,
    ]);
    expect(publicImages[0]).not.toHaveProperty('id');
    expect(publicImages[0]).not.toHaveProperty('storageKey');
    await request(app.getHttpServer())
      .delete(`/api/menu-items/${item.id}/images/${secondImage.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204);
    await request(app.getHttpServer())
      .get(new URL(secondImage.url).pathname)
      .expect(404);
    const remaining = await database.images.findOneOrFail({
      where: { id: firstImage.id },
    });
    expect(remaining.isPrimary).toBe(true);
    // Concurrent promotions remain serialized and the simulated partial index rejects duplicate primaries.
    const replacement = await upload();
    await Promise.all(
      [firstImage.id, replacement.id].map((imageId) =>
        request(app.getHttpServer())
          .patch(`/api/menu-items/${item.id}/images/${imageId}`)
          .auth(token, { type: 'bearer' })
          .send({ isPrimary: true })
          .expect(200),
      ),
    );
    expect(
      database.images.rows.filter(
        (image) => image.menuItemId === item.id && image.isPrimary,
      ),
    ).toHaveLength(1);
    database.protectedMenuItems.add(item.id);
    await request(app.getHttpServer())
      .delete(`/api/menu-items/${item.id}`)
      .auth(token, { type: 'bearer' })
      .expect(409);
    expect(
      database.images.rows.filter((image) => image.menuItemId === item.id),
    ).toHaveLength(2);
    database.protectedMenuItems.delete(item.id);
    await request(app.getHttpServer())
      .delete(`/api/menu-items/${item.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204);
    expect(
      database.images.rows.filter((image) => image.menuItemId === item.id),
    ).toHaveLength(0);
    await request(app.getHttpServer())
      .get(new URL(firstImage.url).pathname)
      .expect(404);
    await request(app.getHttpServer())
      .get(new URL(replacement.url).pathname)
      .expect(404);
  });

  it('publishes complete Swagger request, response, asset and error schemas', async () => {
    const schemas = document.components!.schemas!;
    expect(
      document.paths['/api/categories'].get!.responses['200'],
    ).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CategoryPageDto' },
        },
      },
    });
    expect(
      document.paths['/api/menu-items'].get!.responses['200'],
    ).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/MenuItemPageDto' },
        },
      },
    });
    const categoryQueries = document.paths['/api/categories']
      .get!.parameters!.filter((entry) => 'in' in entry && entry.in === 'query')
      .map((entry) => ('name' in entry ? entry.name : ''));
    expect(categoryQueries).toEqual(
      expect.arrayContaining(['page', 'limit', 'search', 'isActive']),
    );
    expect((schemas.LoginDto as SchemaObject).required).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
    expect(document.paths['/api/auth/me'].get!.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/AuthUserDto' },
        },
      },
    });
    expect(
      document.paths['/api/tables/{id}/qr/rotate'].post!.responses,
    ).toHaveProperty('200');
    const assetParameter = document.paths[
      '/api/branding/{asset}'
    ].put!.parameters!.find(
      (parameter) => 'name' in parameter && parameter.name === 'asset',
    );
    expect(assetParameter).toMatchObject({
      schema: {
        enum: ['logo', 'logo-dark', 'favicon', 'banner', 'login-image'],
      },
    });
    expect(
      (schemas.UpdateBrandingDto as SchemaObject).properties!.fontFamily,
    ).toMatchObject({ type: 'string', nullable: true });
    expect(
      (schemas.UpdateBrandingDto as SchemaObject).properties!.websiteUrl,
    ).toMatchObject({ type: 'string', nullable: true });
    const offline = JSON.parse(
      await readFile(join(process.cwd(), 'docs/openapi.json'), 'utf8'),
    ) as OpenAPIObject;
    expect(
      document.paths['/api/public/orders']?.post?.responses['201'],
    ).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CreatePublicOrderResponseDto' },
        },
      },
    });
    expect(
      document.paths['/api/public/orders/{publicCode}/cancel']?.patch
        ?.responses['409'],
    ).toBeDefined();
    expect(offline.paths).toEqual(document.paths);
    expect(offline.components?.schemas).toEqual(document.components?.schemas);
    await request(app.getHttpServer()).get('/api/docs-json').expect(200);
  });

  it('keeps the counter queue within its restaurant and validates status changes', async () => {
    const tableA = await database.save(
      database.create(DiningTable, {
        restaurantId: first.id,
        label: 'Fila A',
        qrToken: 'queue-a',
        isActive: true,
      }),
    );
    const tableB = await database.save(
      database.create(DiningTable, {
        restaurantId: second.id,
        label: 'Fila B',
        qrToken: 'queue-b',
        isActive: true,
      }),
    );
    const create = (restaurantId: string, tableId: string) =>
      database.save(
        database.create(Order, {
          restaurantId,
          tableId,
          orderDate: '2026-11-10',
          number: 99,
          publicCode: `queue-${restaurantId}`,
          idempotencyKey: `queue-${restaurantId}`,
          guestsCount: 2,
          customerNote: null,
          status: OrderStatus.PENDING,
          totalCents: 500,
          estimatedPrepMinutes: null,
          staffNote: null,
          rejectionReason: null,
          acceptedAt: null,
          readyAt: null,
          deliveredAt: null,
          cancelledAt: null,
        }),
      );
    const own = await create(first.id, tableA.id);
    const foreign = await create(second.id, tableB.id);
    const list = await request(app.getHttpServer())
      .get('/api/orders')
      .auth(counterToken, { type: 'bearer' })
      .query({ status: 'PENDING', date: '2026-11-10' })
      .expect(200);
    const listBody = list.body as StaffOrderPageDto;
    expect(listBody.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: own.id })]),
    );
    expect(listBody.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: foreign.id })]),
    );
    await request(app.getHttpServer())
      .get(`/api/orders/${foreign.id}`)
      .auth(counterToken, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/orders/${foreign.id}/accept`)
      .auth(counterToken, { type: 'bearer' })
      .send({ estimatedPrepMinutes: 20 })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/orders/${own.id}/accept`)
      .auth(counterToken, { type: 'bearer' })
      .send({ estimatedPrepMinutes: 0 })
      .expect(400);
    const accepted = await request(app.getHttpServer())
      .patch(`/api/orders/${own.id}/accept`)
      .auth(counterToken, { type: 'bearer' })
      .send({ estimatedPrepMinutes: 20 })
      .expect(200);
    expect((accepted.body as StaffOrderResponseDto).status).toBe(
      OrderStatus.ACCEPTED,
    );
    await request(app.getHttpServer())
      .patch(`/api/orders/${own.id}/accept`)
      .auth(counterToken, { type: 'bearer' })
      .send({ estimatedPrepMinutes: 20 })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/orders/${own.id}/status`)
      .auth(counterToken, { type: 'bearer' })
      .send({ status: OrderStatus.READY })
      .expect(409);
  });

  it('reports daily sales only for the authenticated admin tenant', async () => {
    const order = await database.save(
      database.create(Order, {
        restaurantId: first.id,
        orderDate: '2031-01-02',
        status: OrderStatus.DELIVERED,
        number: 1,
        totalCents: 2500,
      }),
    );
    await database.save(
      database.create(OrderItem, {
        orderId: order.id,
        menuItemId: 'report-product',
        nameSnapshot: 'Prato relatório',
        quantity: 2,
        lineTotalCents: 2500,
      }),
    );
    const path = '/api/reports/summary?from=2031-01-01&to=2031-01-03';
    const own = await request(app.getHttpServer())
      .get(path)
      .auth(token, { type: 'bearer' })
      .expect(200);
    const ownBody = own.body as SummaryResponseDto;
    expect(ownBody).toMatchObject({
      currency: 'AOA',
      ordersCount: 1,
      salesCents: 2500,
    });
    expect(ownBody.topItems).toEqual([
      expect.objectContaining({ quantity: 2, salesCents: 2500 }),
    ]);
    const foreign = await request(app.getHttpServer())
      .get(path)
      .auth(otherToken, { type: 'bearer' })
      .expect(200);
    expect(foreign.body as SummaryResponseDto).toMatchObject({
      ordersCount: 0,
      salesCents: 0,
    });
    await request(app.getHttpServer())
      .get(path)
      .auth(counterToken, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/reports/summary?from=2031-01-04&to=2031-01-03')
      .auth(token, { type: 'bearer' })
      .expect(400);
  });

  it('streams created orders to staff and accepted status with ETA to the client', async () => {
    await app.listen(0);
    const base = await app.getUrl();
    const staffAbort = new AbortController();
    const publicAbort = new AbortController();
    try {
      const staffResponse = await fetch(`${base}/api/orders/stream`, {
        headers: { Authorization: `Bearer ${counterToken}` },
        signal: staffAbort.signal,
      });
      expect(staffResponse.status).toBe(200);
      const nextStaff = sseReader(staffResponse);
      await nextStaff('connected');
      const table = await database.save(
        database.create(DiningTable, {
          restaurantId: first.id,
          label: 'Mesa SSE',
          qrToken: `sse-${Date.now()}`,
          isActive: true,
        }),
      );
      const category = await database.save(
        database.create(Category, {
          restaurantId: first.id,
          name: `Categoria SSE ${Date.now()}`,
          isActive: true,
        }),
      );
      const product = await database.save(
        database.create(MenuItem, {
          restaurantId: first.id,
          categoryId: category.id,
          name: 'Prato SSE',
          priceCents: 1000,
          isAvailable: true,
        }),
      );
      const created = await request(app.getHttpServer())
        .post('/api/public/orders')
        .send({
          token: table.qrToken,
          guestsCount: 2,
          idempotencyKey: `sse-attempt-${Date.now()}`,
          items: [{ menuItemId: product.id, quantity: 1 }],
        })
        .expect(201);
      const staffEvent = await nextStaff('order.created');
      expect(staffEvent.status).toBe(OrderStatus.PENDING);
      const publicCode = (created.body as { publicCode: string }).publicCode;
      const saved = database.orders.rows.find(
        (order) => order.publicCode === publicCode,
      )!;
      expect(staffEvent.orderId).toBe(saved.id);

      const publicResponse = await fetch(
        `${base}/api/public/orders/${publicCode}/stream`,
        { signal: publicAbort.signal },
      );
      expect(publicResponse.status).toBe(200);
      const nextPublic = sseReader(publicResponse);
      await nextPublic('connected');
      await request(app.getHttpServer())
        .patch(`/api/orders/${saved.id}/accept`)
        .auth(counterToken, { type: 'bearer' })
        .send({ estimatedPrepMinutes: 25 })
        .expect(200);
      const publicEvent = await nextPublic('order.status_changed');
      expect(publicEvent).toMatchObject({
        status: OrderStatus.ACCEPTED,
        estimatedPrepMinutes: 25,
      });
    } finally {
      staffAbort.abort();
      publicAbort.abort();
    }
  }, 15000);

  it('lets the platform filter and inactivate users without moving them between restaurants', async () => {
    const account = await database.users.save(
      database.users.create({
        name: 'Filtered Counter',
        email: 'filtered@example.com',
        restaurantId: second.id,
        role: UserRole.COUNTER,
        isActive: true,
        passwordHash: await bcrypt.hash('filtered-password', 4),
      }),
    );
    const filtered = await request(app.getHttpServer())
      .get('/api/users')
      .auth(superToken, { type: 'bearer' })
      .query({ role: 'COUNTER', restaurantId: second.id, isActive: 'true' })
      .expect(200);
    expect(
      (filtered.body as { id: string; restaurantId: string }[]).map(
        (user) => user.id,
      ),
    ).toContain(account.id);
    expect(
      (filtered.body as { restaurantId: string }[]).every(
        (user) => user.restaurantId === second.id,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .get('/api/users')
      .auth(token, { type: 'bearer' })
      .query({ restaurantId: second.id })
      .expect(403);

    const updated = await request(app.getHttpServer())
      .patch(`/api/users/${account.id}`)
      .auth(superToken, { type: 'bearer' })
      .send({ name: 'Updated Counter', isActive: false })
      .expect(200);
    expect(updated.body).toMatchObject({
      name: 'Updated Counter',
      isActive: false,
      restaurantId: second.id,
    });
    await request(app.getHttpServer())
      .patch(`/api/users/${account.id}`)
      .auth(superToken, { type: 'bearer' })
      .send({ restaurantId: first.id })
      .expect(400);
    const inactive = await request(app.getHttpServer())
      .get('/api/users')
      .auth(superToken, { type: 'bearer' })
      .query({ restaurantId: second.id, isActive: 'false' })
      .expect(200);
    expect(
      (inactive.body as { id: string }[]).map((user) => user.id),
    ).toContain(account.id);
  });

  it('limits anonymous requests by IP with 429 and retry headers', async () => {
    let blocked = false;
    for (let attempt = 0; attempt < 11; attempt++) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'missing@example.com', password: 'invalid-password' });
      if (response.status === 429) {
        expect(response.headers).toHaveProperty('retry-after');
        expect(response.body).toMatchObject({
          statusCode: 429,
          message: 'Demasiados pedidos. Tente novamente mais tarde.',
        });
        blocked = true;
        break;
      }
      expect(response.status).toBe(401);
    }
    expect(blocked).toBe(true);
  });
});
