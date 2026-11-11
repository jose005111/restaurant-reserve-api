import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MemoryDatabase } from '../../../test/in-memory-database';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { DiningTable } from '../tables/entities/dining-table.entity';
import { Order } from './entities/order.entity';
import { transitionOrder } from './order-state-machine';
import { StaffOrdersService } from './staff-orders.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderEventsService } from './order-events.service';

describe('Order state machine', () => {
  it('allows only the defined staff transitions', () => {
    expect(
      transitionOrder(OrderStatus.PENDING, OrderStatus.ACCEPTED, 'accept'),
    ).toBe(OrderStatus.ACCEPTED);
    expect(
      transitionOrder(OrderStatus.PENDING, OrderStatus.REJECTED, 'reject'),
    ).toBe(OrderStatus.REJECTED);
    expect(
      transitionOrder(OrderStatus.ACCEPTED, OrderStatus.PREPARING, 'status'),
    ).toBe(OrderStatus.PREPARING);
    expect(
      transitionOrder(OrderStatus.ACCEPTED, OrderStatus.CANCELLED, 'status'),
    ).toBe(OrderStatus.CANCELLED);
    expect(
      transitionOrder(OrderStatus.PREPARING, OrderStatus.READY, 'status'),
    ).toBe(OrderStatus.READY);
    expect(
      transitionOrder(OrderStatus.PREPARING, OrderStatus.CANCELLED, 'status'),
    ).toBe(OrderStatus.CANCELLED);
    expect(
      transitionOrder(OrderStatus.READY, OrderStatus.DELIVERED, 'status'),
    ).toBe(OrderStatus.DELIVERED);
    for (const from of Object.values(OrderStatus)) {
      for (const to of Object.values(OrderStatus)) {
        for (const action of ['accept', 'reject', 'status'] as const) {
          const allowed =
            (action === 'accept' &&
              from === OrderStatus.PENDING &&
              to === OrderStatus.ACCEPTED) ||
            (action === 'reject' &&
              from === OrderStatus.PENDING &&
              to === OrderStatus.REJECTED) ||
            (action === 'status' &&
              ((from === OrderStatus.ACCEPTED &&
                [OrderStatus.PREPARING, OrderStatus.CANCELLED].includes(to)) ||
                (from === OrderStatus.PREPARING &&
                  [OrderStatus.READY, OrderStatus.CANCELLED].includes(to)) ||
                (from === OrderStatus.READY && to === OrderStatus.DELIVERED)));
          if (!allowed)
            expect(() => transitionOrder(from, to, action)).toThrow(
              ConflictException,
            );
        }
      }
    }
  });
});

describe('Staff orders', () => {
  let db: MemoryDatabase;
  let service: StaffOrdersService;
  let first: Order;
  let second: Order;
  let staff: AuthUser;

  beforeEach(async () => {
    db = new MemoryDatabase();
    service = new StaffOrdersService(
      db as unknown as DataSource,
      new OrderEventsService(new EventEmitter2()),
    );
    const a = await db.save(db.create(Restaurant, { name: 'A' }));
    const b = await db.save(db.create(Restaurant, { name: 'B' }));
    const tableA = await db.save(
      db.create(DiningTable, { restaurantId: a.id, label: 'Mesa A' }),
    );
    const tableB = await db.save(
      db.create(DiningTable, { restaurantId: b.id, label: 'Mesa B' }),
    );
    const make = (restaurantId: string, tableId: string) =>
      db.save(
        db.create(Order, {
          restaurantId,
          tableId,
          orderDate: '2026-11-10',
          number: 1,
          status: OrderStatus.PENDING,
          guestsCount: 2,
          totalCents: 100,
          customerNote: null,
          staffNote: null,
          rejectionReason: null,
          estimatedPrepMinutes: null,
          acceptedAt: null,
          readyAt: null,
          deliveredAt: null,
          cancelledAt: null,
        }),
      );
    first = await make(a.id, tableA.id);
    second = await make(b.id, tableB.id);
    staff = {
      id: 'staff',
      name: 'Staff',
      email: 'staff@example.com',
      role: UserRole.COUNTER,
      restaurantId: a.id,
    };
  });

  it('keeps list, detail, and mutations inside the staff tenant', async () => {
    const page = await service.list(staff, { page: 1, limit: 20 });
    expect(page.meta.total).toBe(1);
    expect(page.items[0].id).toBe(first.id);
    await expect(service.get(staff, second.id)).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.accept(staff, second.id, { estimatedPrepMinutes: 20 }),
    ).rejects.toThrow(NotFoundException);
    expect(
      (await db.findOne(Order, { where: { id: second.id } }))?.status,
    ).toBe(OrderStatus.PENDING);
  });

  it('moves through the full accepted flow and rejects invalid repeats', async () => {
    const accepted = await service.accept(staff, first.id, {
      estimatedPrepMinutes: 20,
      note: 'Urgente',
    });
    expect(accepted.status).toBe(OrderStatus.ACCEPTED);
    expect(accepted.acceptedAt).toBeInstanceOf(Date);
    expect(accepted.staffNote).toBe('Urgente');
    await expect(
      service.accept(staff, first.id, { estimatedPrepMinutes: 20 }),
    ).rejects.toThrow(ConflictException);
    await service.setStatus(staff, first.id, { status: OrderStatus.PREPARING });
    const ready = await service.setStatus(staff, first.id, {
      status: OrderStatus.READY,
    });
    expect(ready.readyAt).toBeInstanceOf(Date);
    const delivered = await service.setStatus(staff, first.id, {
      status: OrderStatus.DELIVERED,
    });
    expect(delivered.deliveredAt).toBeInstanceOf(Date);
    await expect(
      service.setStatus(staff, first.id, { status: OrderStatus.CANCELLED }),
    ).rejects.toThrow(ConflictException);
  });
});
