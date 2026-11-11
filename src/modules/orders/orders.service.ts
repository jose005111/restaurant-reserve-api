import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { isUUID } from 'class-validator';
import { DataSource, EntityManager, In } from 'typeorm';
import { appConfig } from '../../config';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { generateToken } from '../../common/utils/token.util';
import { Category } from '../categories/entities/category.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { RestaurantAvailabilityService } from '../restaurants/restaurant-availability.service';
import { DiningTable } from '../tables/entities/dining-table.entity';
import { CreatePublicOrderDto } from './dto/create-public-order.dto';
import {
  CreatePublicOrderResponseDto,
  PublicOrderResponseDto,
} from './dto/public-order-response.dto';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { transitionClientOrder } from './order-state-machine';
import { OrderEventsService } from './order-events.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly availability: RestaurantAvailabilityService,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    private readonly events: OrderEventsService,
  ) {}

  async create(
    dto: CreatePublicOrderDto,
  ): Promise<CreatePublicOrderResponseDto> {
    const result = await this.dataSource.transaction(async (manager) => {
      const generic = await manager.findOne(Restaurant, {
        where: { publicToken: dto.token },
      });
      const tokenTable = generic
        ? null
        : await manager.findOne(DiningTable, { where: { qrToken: dto.token } });
      const restaurantId = generic?.id ?? tokenTable?.restaurantId;
      if (!restaurantId) throw new NotFoundException('Link não encontrado');
      // Serialises tenant idempotency even when two requests select different tables.
      const restaurant = await manager.findOne(Restaurant, {
        where: { id: restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!restaurant || (generic && restaurant.publicToken !== dto.token))
        throw new NotFoundException('Link não encontrado');
      this.availability.assertEntityAvailable(restaurant);
      let table: DiningTable | null;
      if (tokenTable)
        table = await manager.findOne(DiningTable, {
          where: {
            id: tokenTable.id,
            restaurantId,
            qrToken: dto.token,
            isActive: true,
          },
          lock: { mode: 'pessimistic_write' },
        });
      else {
        if (typeof dto.tableId !== 'string' || !isUUID(dto.tableId))
          throw new BadRequestException(
            'Escolha uma mesa válida para este restaurante',
          );
        table = await manager.findOne(DiningTable, {
          where: { id: dto.tableId, restaurantId, isActive: true },
          lock: { mode: 'pessimistic_write' },
        });
      }
      if (!table) throw new NotFoundException('Mesa activa não encontrada');
      const existing = await manager.findOne(Order, {
        where: { restaurantId, idempotencyKey: dto.idempotencyKey },
      });
      if (existing)
        return { response: this.createdResponse(existing), order: null };
      const pending = await manager.count(Order, {
        where: { restaurantId, tableId: table.id, status: OrderStatus.PENDING },
      });
      if (pending >= this.config.maxPendingOrdersPerTable)
        throw new ConflictException(
          'A mesa atingiu o limite de pedidos pendentes',
        );
      const ids = dto.items.map((item) => item.menuItemId);
      if (new Set(ids).size !== ids.length)
        throw new BadRequestException('Não repita o mesmo produto no pedido');
      // Locks prevent prices/availability changing while snapshots are constructed.
      const menu = await manager.find(MenuItem, {
        where: { restaurantId, id: In(ids), isAvailable: true },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_read' },
      });
      const categoryIds = [...new Set(menu.map((item) => item.categoryId))];
      const categories = categoryIds.length
        ? await manager.find(Category, {
            where: { restaurantId, id: In(categoryIds), isActive: true },
            order: { id: 'ASC' },
            lock: { mode: 'pessimistic_read' },
          })
        : [];
      if (
        menu.length !== ids.length ||
        menu.some(
          (item) =>
            !categories.some((category) => category.id === item.categoryId),
        )
      )
        throw new BadRequestException(
          'Um ou mais produtos estão indisponíveis',
        );
      const lines = dto.items.map((input) => {
        const product = menu.find((item) => item.id === input.menuItemId)!;
        return manager.create(OrderItem, {
          menuItemId: product.id,
          nameSnapshot: product.name,
          unitPriceCents: product.priceCents,
          quantity: input.quantity,
          note: input.note ?? null,
          lineTotalCents: product.priceCents * input.quantity,
        });
      });
      const totalCents = lines.reduce(
        (sum, line) => sum + line.lineTotalCents,
        0,
      );
      if (
        !Number.isSafeInteger(totalCents) ||
        totalCents < 0 ||
        totalCents > 2147483647
      )
        throw new BadRequestException(
          'O total do pedido ultrapassa o limite permitido',
        );
      const result: unknown = await manager.query(
        "SELECT next_order_number($1) AS number, (now() AT TIME ZONE 'Africa/Luanda')::date::text AS order_date",
        [restaurantId],
      );
      const counter = (result as { number: number; order_date: string }[])[0];
      const order = await manager.save(
        manager.create(Order, {
          restaurantId,
          tableId: table.id,
          orderDate: counter.order_date,
          number: counter.number,
          publicCode: generateToken(16),
          guestsCount: dto.guestsCount,
          customerNote: dto.customerNote ?? null,
          status: OrderStatus.PENDING,
          estimatedPrepMinutes: null,
          staffNote: null,
          rejectionReason: null,
          totalCents,
          idempotencyKey: dto.idempotencyKey,
          acceptedAt: null,
          readyAt: null,
          deliveredAt: null,
          cancelledAt: null,
        }),
      );
      for (const line of lines)
        await manager.save(Object.assign(line, { orderId: order.id }));
      return { response: this.createdResponse(order), order };
    });
    if (result.order) this.events.created(result.order);
    return result.response;
  }

  get(publicCode: string): Promise<PublicOrderResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { publicCode } });
      if (!order) throw new NotFoundException('Pedido não encontrado');
      return this.toPublic(manager, order);
    });
  }

  async cancel(publicCode: string): Promise<PublicOrderResponseDto> {
    const result = await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { publicCode },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Pedido não encontrado');
      const restaurant = await manager.findOne(Restaurant, {
        where: { id: order.restaurantId },
      });
      if (!restaurant) throw new NotFoundException('Pedido não encontrado');
      this.availability.assertEntityAvailable(restaurant);
      order.status = transitionClientOrder(order.status, OrderStatus.CANCELLED);
      order.cancelledAt = new Date();
      const saved = await manager.save(order);
      return { response: await this.toPublic(manager, saved), order: saved };
    });
    this.events.statusChanged(result.order);
    return result.response;
  }

  private createdResponse(order: Order): CreatePublicOrderResponseDto {
    return {
      publicCode: order.publicCode,
      number: order.number,
      status: order.status,
      message: 'Pedido enviado',
    };
  }
  private async toPublic(
    manager: EntityManager,
    order: Order,
  ): Promise<PublicOrderResponseDto> {
    const restaurant = await manager.findOne(Restaurant, {
      where: { id: order.restaurantId },
    });
    if (!restaurant) throw new NotFoundException('Pedido não encontrado');
    this.availability.assertEntityAvailable(restaurant);
    const table = await manager.findOne(DiningTable, {
      where: { id: order.tableId, restaurantId: order.restaurantId },
    });
    if (!table) throw new NotFoundException('Mesa não encontrada');
    const items = await manager.find(OrderItem, {
      where: { orderId: order.id },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return {
      publicCode: order.publicCode,
      number: order.number,
      orderDate: order.orderDate,
      status: order.status,
      restaurantName: restaurant.name,
      currency: restaurant.currency,
      tableLabel: table.label,
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
      rejectionReason: order.rejectionReason,
      createdAt: order.createdAt,
      acceptedAt: order.acceptedAt,
      readyAt: order.readyAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
    };
  }
}
