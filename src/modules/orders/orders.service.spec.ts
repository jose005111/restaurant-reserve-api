import { jest } from '@jest/globals';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { ConfigType } from '@nestjs/config';
import { appConfig } from '../../config';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { RestaurantStatus } from '../../common/enums/restaurant-status.enum';
import { RestaurantAvailabilityService } from '../restaurants/restaurant-availability.service';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { DiningTable } from '../tables/entities/dining-table.entity';
import { Category } from '../categories/entities/category.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { MemoryDatabase } from '../../../test/in-memory-database';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrdersService } from './orders.service';
import { transitionClientOrder } from './order-state-machine';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ORDER_CREATED, OrderEventsService } from './order-events.service';

describe('Client order state machine', () => {
  it('allows only PENDING to CANCELLED', () => {
    expect(
      transitionClientOrder(OrderStatus.PENDING, OrderStatus.CANCELLED),
    ).toBe(OrderStatus.CANCELLED);
    for (const status of Object.values(OrderStatus).filter(
      (status) => status !== OrderStatus.PENDING,
    ))
      expect(() =>
        transitionClientOrder(status, OrderStatus.CANCELLED),
      ).toThrow(ConflictException);
    expect(() =>
      transitionClientOrder(OrderStatus.PENDING, OrderStatus.ACCEPTED),
    ).toThrow(ConflictException);
  });
});
describe('Order atomicity and integrity', () => {
  let db: MemoryDatabase,
    service: OrdersService,
    restaurant: Restaurant,
    table: DiningTable,
    product: MenuItem;
  let emitter: EventEmitter2;
  beforeEach(async () => {
    db = new MemoryDatabase();
    emitter = new EventEmitter2();
    const availability = new RestaurantAvailabilityService(
      db.restaurants as unknown as import('typeorm').Repository<Restaurant>,
    );
    service = new OrdersService(
      db as unknown as DataSource,
      availability,
      {
        maxPendingOrdersPerTable: 3,
      } as ConfigType<typeof appConfig>,
      new OrderEventsService(emitter),
    );
    restaurant = await db.save(
      db.create(Restaurant, {
        publicToken: 'generic',
        status: RestaurantStatus.ACTIVE,
        subscriptionExpiresAt: null,
      }),
    );
    table = await db.save(
      db.create(DiningTable, {
        restaurantId: restaurant.id,
        qrToken: 'table',
        isActive: true,
      }),
    );
    const category = await db.save(
      db.create(Category, {
        restaurantId: restaurant.id,
        name: 'Pratos',
        isActive: true,
      }),
    );
    product = await db.save(
      db.create(MenuItem, {
        restaurantId: restaurant.id,
        categoryId: category.id,
        name: 'Calulu',
        priceCents: 900,
        isAvailable: true,
      }),
    );
  });
  const payload = (product: MenuItem, table: DiningTable) => ({
    token: 'generic',
    tableId: table.id,
    guestsCount: 2,
    idempotencyKey: 'once',
    items: [{ menuItemId: product.id, quantity: 2 }],
  });
  it('uses locks and calls next_order_number inside the transaction', async () => {
    const transaction = jest.spyOn(db, 'transaction');
    const findOne = jest.spyOn(db, 'findOne');
    const query = jest.spyOn(db, 'query');
    const result = await service.create(payload(product, table));
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith(Restaurant, {
      where: { id: restaurant.id },
      lock: { mode: 'pessimistic_write' },
    });
    expect(findOne).toHaveBeenCalledWith(DiningTable, {
      where: { id: table.id, restaurantId: restaurant.id, isActive: true },
      lock: { mode: 'pessimistic_write' },
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('next_order_number($1)'),
      [restaurant.id],
    );
    expect(result.number).toBe(1);
    expect(db.orders.rows[0].totalCents).toBe(1800);
    expect(db.orderItems.rows[0]).toMatchObject({
      unitPriceCents: 900,
      nameSnapshot: 'Calulu',
      lineTotalCents: 1800,
    });
  });
  it('rolls back order, items and counter when persisting an item fails', async () => {
    const save = jest
      .spyOn(db.orderItems, 'save')
      .mockRejectedValueOnce(new Error('Simulated item failure'));
    await expect(service.create(payload(product, table))).rejects.toThrow(
      'Simulated item failure',
    );
    expect(db.orders.rows).toHaveLength(0);
    expect(db.orderItems.rows).toHaveLength(0);
    save.mockRestore();
    expect((await service.create(payload(product, table))).number).toBe(1);
  });
  it('rejects totals that would overflow PostgreSQL integer before consuming a number', async () => {
    await db.items.update(product.id, { priceCents: 2147483647 });
    await expect(service.create(payload(product, table))).rejects.toThrow(
      BadRequestException,
    );
    expect(db.orders.rows).toHaveLength(0);
    await db.items.update(product.id, { priceCents: 900 });
    expect((await service.create(payload(product, table))).number).toBe(1);
  });
  it('returns original cancelled order for an idempotent retry', async () => {
    const created = await service.create(payload(product, table));
    const order = db.orders.rows[0];
    await db.orders.update(order.id, {
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date(),
    });
    const result = await service.create(payload(product, table));
    expect(result).toMatchObject({
      publicCode: created.publicCode,
      number: 1,
      status: OrderStatus.CANCELLED,
    });
    expect(db.orders.rows).toHaveLength(1);
    expect(db.orderItems.rows).toHaveLength(1);
  });
  it('publishes creation only after commit and not on an idempotent retry', async () => {
    const seen: string[] = [];
    emitter.on(ORDER_CREATED, (event: { orderId: string }) => {
      expect(db.orders.rows.some((row) => row.id === event.orderId)).toBe(true);
      seen.push(event.orderId);
    });
    await service.create(payload(product, table));
    await service.create(payload(product, table));
    expect(seen).toEqual([db.orders.rows[0].id]);
  });
  it('applies the configured pending limit and prevents cancellation from accepted state', async () => {
    service = new OrdersService(
      db as unknown as DataSource,
      new RestaurantAvailabilityService(
        db.restaurants as unknown as import('typeorm').Repository<Restaurant>,
      ),
      { maxPendingOrdersPerTable: 1 } as ConfigType<typeof appConfig>,
      new OrderEventsService(new EventEmitter2()),
    );
    const created = await service.create(payload(product, table));
    await expect(
      service.create({ ...payload(product, table), idempotencyKey: 'second' }),
    ).rejects.toThrow(ConflictException);
    await db.orders.update(db.orders.rows[0].id, {
      status: OrderStatus.ACCEPTED,
      estimatedPrepMinutes: 20,
    });
    await expect(service.cancel(created.publicCode)).rejects.toThrow(
      ConflictException,
    );
    expect(db.orders.rows[0].status).toBe(OrderStatus.ACCEPTED);
  });
  it('menu product referenced by an order is protected against removal', async () => {
    await service.create(payload(product, table));
    await expect(async () => db.remove(product)).rejects.toMatchObject({
      driverError: { code: '23503' },
    });
    expect(db.getRepository(Order).rows).toHaveLength(1);
    expect(db.getRepository(OrderItem).rows).toHaveLength(1);
  });
});
