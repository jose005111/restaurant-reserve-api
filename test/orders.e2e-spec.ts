import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { appConfig } from '../src/config';
import { SecurityModule } from '../src/common/security.module';
import { RestaurantStatus } from '../src/common/enums/restaurant-status.enum';
import { OrderStatus } from '../src/common/enums/order-status.enum';
import { Restaurant } from '../src/modules/restaurants/entities/restaurant.entity';
import { DiningTable } from '../src/modules/tables/entities/dining-table.entity';
import { Category } from '../src/modules/categories/entities/category.entity';
import { MenuItem } from '../src/modules/menu/entities/menu-item.entity';
import { Order } from '../src/modules/orders/entities/order.entity';
import { OrderItem } from '../src/modules/orders/entities/order-item.entity';
import { OrdersModule } from '../src/modules/orders/orders.module';
import {
  PublicOrderResponseDto,
  CreatePublicOrderResponseDto,
} from '../src/modules/orders/dto/public-order-response.dto';
import { setupApp } from '../src/setup-app';
import { MemoryDatabase } from './in-memory-database';
const database = new MemoryDatabase();
@Global()
@Module({
  providers: [
    { provide: DataSource, useValue: database },
    { provide: appConfig.KEY, useValue: { maxPendingOrdersPerTable: 3 } },
  ],
  exports: [DataSource, appConfig.KEY],
})
class InfrastructureModule {}

describe('Public orders HTTP (isolated transactions)', () => {
  let app: NestExpressApplication;
  let restaurant: Restaurant,
    otherRestaurant: Restaurant,
    table: DiningTable,
    otherTable: DiningTable,
    product: MenuItem,
    foreignProduct: MenuItem;
  let sequence = 0;
  const body = (extra: Record<string, unknown> = {}) => ({
    token: restaurant.publicToken,
    tableId: table.id,
    guestsCount: 2,
    idempotencyKey: `attempt-${++sequence}`,
    items: [{ menuItemId: product.id, quantity: 2, note: ' sem picante ' }],
    ...extra,
  });
  const post = (payload: object) =>
    request(app.getHttpServer()).post('/api/public/orders').send(payload);
  const get = (code: string) =>
    request(app.getHttpServer()).get(`/api/public/orders/${code}`);
  const cancel = (code: string) =>
    request(app.getHttpServer()).patch(`/api/public/orders/${code}/cancel`);
  beforeAll(async () => {
    const builder = Test.createTestingModule({
      imports: [InfrastructureModule, SecurityModule, OrdersModule],
    });
    for (const entity of [Restaurant, Order, OrderItem])
      builder
        .overrideProvider(getRepositoryToken(entity))
        .useValue(
          database.getRepository<Restaurant | Order | OrderItem>(entity),
        );
    const module = await builder.compile();
    app = module.createNestApplication<NestExpressApplication>();
    setupApp(app, {
      storageLocalPath: '/tmp/restaurant-orders-tests',
      corsOrigins: [],
    });
    await app.init();
  });
  beforeEach(async () => {
    app.get<ThrottlerStorageService>(ThrottlerStorage).onApplicationShutdown();
    for (const repo of [
      database.restaurants,
      database.tables,
      database.categories,
      database.items,
      database.orders,
      database.orderItems,
    ])
      repo.rows = [];
    restaurant = await database.save(
      database.create(Restaurant, {
        name: 'Luanda',
        currency: 'AOA',
        publicToken: randomUUID(),
        status: RestaurantStatus.ACTIVE,
        subscriptionExpiresAt: null,
      }),
    );
    otherRestaurant = await database.save(
      database.create(Restaurant, {
        name: 'Benguela',
        currency: 'AOA',
        publicToken: randomUUID(),
        status: RestaurantStatus.ACTIVE,
        subscriptionExpiresAt: null,
      }),
    );
    table = await database.save(
      database.create(DiningTable, {
        restaurantId: restaurant.id,
        label: 'Mesa 1',
        qrToken: randomUUID(),
        isActive: true,
      }),
    );
    otherTable = await database.save(
      database.create(DiningTable, {
        restaurantId: otherRestaurant.id,
        label: 'Outra',
        qrToken: randomUUID(),
        isActive: true,
      }),
    );
    const category = await database.save(
      database.create(Category, {
        restaurantId: restaurant.id,
        name: 'Pratos',
        isActive: true,
      }),
    );
    product = await database.save(
      database.create(MenuItem, {
        restaurantId: restaurant.id,
        categoryId: category.id,
        name: 'Calulu',
        priceCents: 1250,
        isAvailable: true,
      }),
    );
    foreignProduct = await database.save(
      database.create(MenuItem, {
        restaurantId: otherRestaurant.id,
        categoryId: randomUUID(),
        name: 'Outro',
        priceCents: 1,
        isAvailable: true,
      }),
    );
  });
  afterAll(async () => {
    await app.close();
  });
  it('creates snapshots, hides internal data, ignores even invalid tableId for TABLE and survives rotation', async () => {
    const response = await post(
      body({ token: table.qrToken, tableId: { invalid: true } }),
    ).expect(201);
    const created = response.body as CreatePublicOrderResponseDto;
    expect(created).toMatchObject({
      status: 'PENDING',
      message: 'Pedido enviado',
    });
    expect(created.publicCode).toMatch(/^[a-f0-9]{32}$/);
    await database.items.update(product.id, {
      name: 'Renomeado',
      priceCents: 9999,
    });
    await database.tables.update(table.id, { qrToken: randomUUID() });
    const detail = await get(created.publicCode).expect(200);
    expect(detail.body).toMatchObject({
      restaurantName: 'Luanda',
      tableLabel: 'Mesa 1',
      totalCents: 2500,
      items: [
        {
          nameSnapshot: 'Calulu',
          unitPriceCents: 1250,
          quantity: 2,
          note: 'sem picante',
          lineTotalCents: 2500,
        },
      ],
    });
    expect(detail.body).not.toHaveProperty('id');
    expect(detail.body).not.toHaveProperty('restaurantId');
    expect(detail.body).not.toHaveProperty('idempotencyKey');
    expect(database.orders.rows[0].tableId).toBe(table.id);
  });
  it('replays concurrent identical keys once and scopes keys per tenant', async () => {
    const payload = body({ idempotencyKey: 'same' });
    const results = await Promise.all([
      post(payload),
      post(payload),
      post(payload),
    ]);
    results.forEach((result) => expect(result.status).toBe(201));
    expect(
      new Set(
        results.map(
          (result) => (result.body as CreatePublicOrderResponseDto).publicCode,
        ),
      ).size,
    ).toBe(1);
    expect(database.orders.rows).toHaveLength(1);
    expect(database.orderItems.rows).toHaveLength(1);
    const same = await post({
      ...payload,
      items: [{ menuItemId: foreignProduct.id, quantity: 1 }],
    }).expect(201);
    expect(same.body).toEqual(results[0].body);
    // A valid product of the second tenant uses the same key independently.
    const category = await database.save(
      database.create(Category, {
        restaurantId: otherRestaurant.id,
        name: 'Outros',
        isActive: true,
      }),
    );
    await database.items.update(foreignProduct.id, { categoryId: category.id });
    await post({
      ...payload,
      token: otherRestaurant.publicToken,
      tableId: otherTable.id,
      items: [{ menuItemId: foreignProduct.id, quantity: 1 }],
    }).expect(201);
    expect(database.orders.rows).toHaveLength(2);
  });
  it('validates generic table selection, token and active/tenant isolation', async () => {
    await post(body({ tableId: undefined })).expect(400);
    await post(body({ tableId: 'bad' })).expect(400);
    await post(body({ tableId: otherTable.id })).expect(404);
    await post(body({ token: 'unknown' })).expect(404);
    await database.tables.update(table.id, { isActive: false });
    await post(body()).expect(404);
    await post(body({ token: table.qrToken })).expect(404);
    expect(database.orders.rows).toHaveLength(0);
  });
  it('rejects unavailable/foreign products, inactive category, duplicate lines and client prices', async () => {
    await post(
      body({ items: [{ menuItemId: foreignProduct.id, quantity: 1 }] }),
    ).expect(400);
    await post(
      body({
        items: [{ menuItemId: product.id, quantity: 1, unitPriceCents: 1 }],
      }),
    ).expect(400);
    await post(
      body({
        items: [
          { menuItemId: product.id, quantity: 1 },
          { menuItemId: product.id, quantity: 1 },
        ],
      }),
    ).expect(400);
    await database.items.update(product.id, { isAvailable: false });
    await post(body()).expect(400);
    await database.items.update(product.id, { isAvailable: true });
    await database.categories.update(product.categoryId, { isActive: false });
    await post(body()).expect(400);
    expect(database.orders.rows).toHaveLength(0);
    expect(database.orderItems.rows).toHaveLength(0);
  });
  it('bounds pending orders under concurrency for both links and cancellation releases capacity', async () => {
    const responses = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        post(body(index % 2 ? { token: table.qrToken } : {})),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 201, 201, 409,
    ]);
    const codes = responses
      .filter((response) => response.status === 201)
      .map(
        (response) =>
          (response.body as CreatePublicOrderResponseDto).publicCode,
      );
    const numbers = database.orders.rows.map((order) => order.number);
    expect(new Set(numbers).size).toBe(3);
    expect([...numbers].sort((a, b) => a - b)).toEqual([
      numbers[0],
      numbers[0] + 1,
      numbers[0] + 2,
    ]);
    const cancelled = await cancel(codes[0]).expect(200);
    expect((cancelled.body as PublicOrderResponseDto).status).toBe(
      OrderStatus.CANCELLED,
    );
    expect((cancelled.body as PublicOrderResponseDto).cancelledAt).toBeTruthy();
    await cancel(codes[0]).expect(409);
    await post(body()).expect(201);
  });
  it('blocks suspended/expired tenants on create, get and cancel', async () => {
    const created = await post(body()).expect(201);
    const code = (created.body as CreatePublicOrderResponseDto).publicCode;
    for (const change of [
      { status: RestaurantStatus.SUSPENDED },
      { status: RestaurantStatus.ACTIVE, subscriptionExpiresAt: new Date(0) },
    ]) {
      await database.restaurants.update(restaurant.id, change);
      await post(body()).expect(403);
      await get(code).expect(403);
      await cancel(code).expect(403);
    }
  });
  it('rejects malformed fields, quantities, empty/oversized carts and unknown order codes', async () => {
    for (const change of [
      { guestsCount: 0 },
      { guestsCount: 51 },
      { guestsCount: 1.5 },
      { items: [] },
      {
        items: Array.from({ length: 51 }, () => ({
          menuItemId: product.id,
          quantity: 1,
        })),
      },
      { items: [{ menuItemId: product.id, quantity: 100 }] },
      { customerNote: 'x'.repeat(501) },
      { idempotencyKey: '' },
    ])
      await post(body(change)).expect(400);
    await get('missing').expect(404);
    await cancel('missing').expect(404);
  });
  it('rate limits order creation by IP', async () => {
    const responses: request.Response[] = [];
    for (let index = 0; index < 11; index++) responses.push(await post(body()));
    expect(
      responses.slice(0, 10).every((response) => response.status !== 429),
    ).toBe(true);
    expect(responses[10].status).toBe(429);
  });
});
