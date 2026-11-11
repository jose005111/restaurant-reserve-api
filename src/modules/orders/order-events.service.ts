import { Injectable, MessageEvent } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Observable,
  fromEventPattern,
  interval,
  map,
  merge,
  of,
  filter,
} from 'rxjs';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { Order } from './entities/order.entity';

export const ORDER_CREATED = 'order.created';
export const ORDER_STATUS_CHANGED = 'order.status_changed';

export interface OrderEvent {
  orderId: string;
  restaurantId: string;
  publicCode: string;
  status: OrderStatus;
  estimatedPrepMinutes: number | null;
}

@Injectable()
export class OrderEventsService {
  constructor(private readonly emitter: EventEmitter2) {}

  created(order: Order): void {
    this.emitter.emit(ORDER_CREATED, this.toEvent(order));
  }

  statusChanged(order: Order): void {
    this.emitter.emit(ORDER_STATUS_CHANGED, this.toEvent(order));
  }

  staffStream(restaurantId: string): Observable<MessageEvent> {
    return merge(
      of<MessageEvent>({ type: 'connected', data: {} }),
      this.eventStream(ORDER_CREATED).pipe(
        filter((event) => event.restaurantId === restaurantId),
        map((event) => this.toMessage(ORDER_CREATED, event)),
      ),
      this.eventStream(ORDER_STATUS_CHANGED).pipe(
        filter((event) => event.restaurantId === restaurantId),
        map((event) => this.toMessage(ORDER_STATUS_CHANGED, event)),
      ),
      this.heartbeat(),
    );
  }

  publicStream(publicCode: string): Observable<MessageEvent> {
    return merge(
      of<MessageEvent>({ type: 'connected', data: {} }),
      this.eventStream(ORDER_STATUS_CHANGED).pipe(
        filter((event) => event.publicCode === publicCode),
        map((event) => ({
          type: ORDER_STATUS_CHANGED,
          data: {
            status: event.status,
            estimatedPrepMinutes: event.estimatedPrepMinutes,
          },
        })),
      ),
      this.heartbeat(),
    );
  }

  private eventStream(name: string): Observable<OrderEvent> {
    return fromEventPattern<OrderEvent>(
      (handler) => this.emitter.on(name, handler),
      (handler) => this.emitter.off(name, handler),
    );
  }

  private heartbeat(): Observable<MessageEvent> {
    return interval(20_000).pipe(
      map(() => ({
        type: 'heartbeat',
        data: { timestamp: new Date().toISOString() },
      })),
    );
  }

  private toEvent(order: Order): OrderEvent {
    return {
      orderId: order.id,
      restaurantId: order.restaurantId,
      publicCode: order.publicCode,
      status: order.status,
      estimatedPrepMinutes: order.estimatedPrepMinutes,
    };
  }

  private toMessage(type: string, event: OrderEvent): MessageEvent {
    return {
      type,
      data: {
        orderId: event.orderId,
        status: event.status,
        estimatedPrepMinutes: event.estimatedPrepMinutes,
      },
    };
  }
}
