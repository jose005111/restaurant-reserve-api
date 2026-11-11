import { EventEmitter2 } from '@nestjs/event-emitter';
import { firstValueFrom, filter, take } from 'rxjs';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { Order } from './entities/order.entity';
import {
  ORDER_CREATED,
  ORDER_STATUS_CHANGED,
  OrderEventsService,
} from './order-events.service';

describe('Order SSE events', () => {
  const order = (
    restaurantId: string,
    publicCode: string,
    status: OrderStatus,
  ) =>
    Object.assign(new Order(), {
      id: `${restaurantId}-${publicCode}`,
      restaurantId,
      publicCode,
      status,
      estimatedPrepMinutes: status === OrderStatus.ACCEPTED ? 25 : null,
    });

  it('delivers created orders only to the matching restaurant', async () => {
    const emitter = new EventEmitter2();
    const events = new OrderEventsService(emitter);
    const a = firstValueFrom(
      events.staffStream('a').pipe(
        filter((message) => message.type === ORDER_CREATED),
        take(1),
      ),
    );
    const b = firstValueFrom(
      events.staffStream('b').pipe(
        filter((message) => message.type === ORDER_CREATED),
        take(1),
      ),
    );
    events.created(order('a', 'one', OrderStatus.PENDING));
    events.created(order('b', 'two', OrderStatus.PENDING));
    expect((await a).data).toMatchObject({
      orderId: 'a-one',
      status: OrderStatus.PENDING,
    });
    expect((await b).data).toMatchObject({
      orderId: 'b-two',
      status: OrderStatus.PENDING,
    });
    expect(emitter.listenerCount(ORDER_CREATED)).toBe(0);
  });

  it('sends status and estimate only to the matching public code', async () => {
    const emitter = new EventEmitter2();
    const events = new OrderEventsService(emitter);
    const target = firstValueFrom(
      events.publicStream('one').pipe(
        filter((message) => message.type === ORDER_STATUS_CHANGED),
        take(1),
      ),
    );
    events.statusChanged(order('b', 'two', OrderStatus.ACCEPTED));
    events.statusChanged(order('a', 'one', OrderStatus.ACCEPTED));
    expect((await target).data).toEqual({
      status: OrderStatus.ACCEPTED,
      estimatedPrepMinutes: 25,
    });
    expect(emitter.listenerCount(ORDER_STATUS_CHANGED)).toBe(0);
  });
});
