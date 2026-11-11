import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, FindOptionsWhere } from 'typeorm';
import { paginationMeta } from '../../common/dto/pagination.dto';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { requireRestaurantId } from '../../common/utils/tenant.util';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { DiningTable } from '../tables/entities/dining-table.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { transitionOrder, type OrderAction } from './order-state-machine';
import { OrderEventsService } from './order-events.service';
import {
  AcceptOrderDto,
  ChangeOrderStatusDto,
  ListOrdersQueryDto,
  RejectOrderDto,
  StaffOrderPageDto,
  StaffOrderResponseDto,
} from './dto/staff-order.dto';

@Injectable()
export class StaffOrdersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly events: OrderEventsService,
  ) {}

  async list(
    user: AuthUser,
    query: ListOrdersQueryDto,
  ): Promise<StaffOrderPageDto> {
    const where: FindOptionsWhere<Order> = {
      restaurantId: requireRestaurantId(user),
    };
    if (query.status) where.status = query.status;
    if (query.tableId) where.tableId = query.tableId;
    if (query.date) where.orderDate = query.date;
    const [orders, total] = await this.dataSource
      .getRepository(Order)
      .findAndCount({
        where,
        order: { createdAt: 'DESC', id: 'DESC' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      });
    const items = await this.dataSource.transaction((manager) =>
      Promise.all(orders.map((order) => this.toResponse(manager, order))),
    );
    return { items, meta: paginationMeta(total, query.page, query.limit) };
  }

  async get(user: AuthUser, id: string): Promise<StaffOrderResponseDto> {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id, restaurantId: requireRestaurantId(user) },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    return this.dataSource.transaction((manager) =>
      this.toResponse(manager, order),
    );
  }

  accept(
    user: AuthUser,
    id: string,
    dto: AcceptOrderDto,
  ): Promise<StaffOrderResponseDto> {
    return this.change(
      user,
      id,
      OrderStatus.ACCEPTED,
      'accept',
      (order, now) => {
        order.estimatedPrepMinutes = dto.estimatedPrepMinutes;
        order.staffNote = dto.note ?? null;
        order.acceptedAt = now;
      },
    );
  }

  reject(
    user: AuthUser,
    id: string,
    dto: RejectOrderDto,
  ): Promise<StaffOrderResponseDto> {
    return this.change(user, id, OrderStatus.REJECTED, 'reject', (order) => {
      order.rejectionReason = dto.reason;
    });
  }

  setStatus(
    user: AuthUser,
    id: string,
    dto: ChangeOrderStatusDto,
  ): Promise<StaffOrderResponseDto> {
    return this.change(user, id, dto.status, 'status', (order, now) => {
      if (dto.status === OrderStatus.READY) order.readyAt = now;
      if (dto.status === OrderStatus.DELIVERED) order.deliveredAt = now;
      if (dto.status === OrderStatus.CANCELLED) order.cancelledAt = now;
    });
  }

  private async change(
    user: AuthUser,
    id: string,
    target: OrderStatus,
    action: OrderAction,
    update: (order: Order, now: Date) => void,
  ): Promise<StaffOrderResponseDto> {
    const result = await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id, restaurantId: requireRestaurantId(user) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Pedido não encontrado');
      order.status = transitionOrder(order.status, target, action);
      update(order, new Date());
      const saved = await manager.save(order);
      return { response: await this.toResponse(manager, saved), order: saved };
    });
    this.events.statusChanged(result.order);
    return result.response;
  }

  private async toResponse(
    manager: EntityManager,
    order: Order,
  ): Promise<StaffOrderResponseDto> {
    const [table, items] = await Promise.all([
      manager.findOne(DiningTable, {
        where: { id: order.tableId, restaurantId: order.restaurantId },
      }),
      manager.find(OrderItem, {
        where: { orderId: order.id },
        order: { createdAt: 'ASC', id: 'ASC' },
      }),
    ]);
    if (!table) throw new NotFoundException('Mesa não encontrada');
    return {
      id: order.id,
      tableId: order.tableId,
      tableLabel: table.label,
      number: order.number,
      orderDate: order.orderDate,
      status: order.status,
      guestsCount: order.guestsCount,
      customerNote: order.customerNote,
      items: items.map((item) => ({
        nameSnapshot: item.nameSnapshot,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        note: item.note,
        lineTotalCents: item.lineTotalCents,
      })),
      totalCents: order.totalCents,
      estimatedPrepMinutes: order.estimatedPrepMinutes,
      staffNote: order.staffNote,
      rejectionReason: order.rejectionReason,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      acceptedAt: order.acceptedAt,
      readyAt: order.readyAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
    };
  }
}
