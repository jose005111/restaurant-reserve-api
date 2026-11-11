import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MemoryDatabase } from '../../../test/in-memory-database';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { ReportsService } from './reports.service';

describe('Reports summary', () => {
  let db: MemoryDatabase;
  let service: ReportsService;
  let user: AuthUser;

  beforeEach(async () => {
    db = new MemoryDatabase();
    service = new ReportsService(db as unknown as DataSource);
    const restaurant = await db.save(
      db.create(Restaurant, { name: 'A', currency: 'AOA' }),
    );
    const other = await db.save(
      db.create(Restaurant, { name: 'B', currency: 'USD' }),
    );
    user = {
      id: 'admin',
      name: 'Admin',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      restaurantId: restaurant.id,
    };
    const make = async (
      restaurantId: string,
      date: string,
      status: OrderStatus,
      totalCents: number,
      number: number,
    ) => {
      const order = await db.save(
        db.create(Order, {
          restaurantId,
          orderDate: date,
          status,
          totalCents,
          number,
        }),
      );
      await db.save(
        db.create(OrderItem, {
          orderId: order.id,
          menuItemId: 'product',
          nameSnapshot: 'Calulu',
          quantity: 2,
          lineTotalCents: totalCents,
        }),
      );
      return order;
    };
    await make(restaurant.id, '2026-11-08', OrderStatus.ACCEPTED, 1000, 1);
    await make(restaurant.id, '2026-11-08', OrderStatus.PENDING, 2000, 2);
    await make(restaurant.id, '2026-11-10', OrderStatus.DELIVERED, 3000, 3);
    await make(restaurant.id, '2026-11-10', OrderStatus.REJECTED, 4000, 4);
    await make(other.id, '2026-11-10', OrderStatus.DELIVERED, 9999, 1);
  });

  it('fills empty days, excludes unaccepted orders from sales, and isolates tenants', async () => {
    const result = await service.summary(user, {
      from: '2026-11-08',
      to: '2026-11-10',
    });
    expect(result).toMatchObject({
      currency: 'AOA',
      ordersCount: 4,
      salesCents: 4000,
    });
    expect(result.days).toEqual([
      { date: '2026-11-08', ordersCount: 2, salesCents: 1000 },
      { date: '2026-11-09', ordersCount: 0, salesCents: 0 },
      { date: '2026-11-10', ordersCount: 2, salesCents: 3000 },
    ]);
    expect(result.topItems).toEqual([
      {
        menuItemId: 'product',
        nameSnapshot: 'Calulu',
        quantity: 4,
        salesCents: 4000,
      },
    ]);
  });

  it('rejects reversed or oversized periods', async () => {
    await expect(
      service.summary(user, { from: '2026-11-11', to: '2026-11-10' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.summary(user, { from: '2026-10-01', to: '2026-11-10' }),
    ).rejects.toThrow(BadRequestException);
  });
});
