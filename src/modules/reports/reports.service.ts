import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Between, DataSource, In } from 'typeorm';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { requireRestaurantId } from '../../common/utils/tenant.util';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { SummaryQueryDto } from './dto/summary-query.dto';
import {
  DailySummaryDto,
  SummaryResponseDto,
  TopItemDto,
} from './dto/summary-response.dto';

const DAY_MS = 86_400_000;
const billableStatuses = new Set([
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.DELIVERED,
]);

function dateAtUtc(value: string): number {
  return Date.parse(`${value}T00:00:00Z`);
}

function dateString(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

function todayInLuanda(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Luanda',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

@Injectable()
export class ReportsService {
  constructor(private readonly dataSource: DataSource) {}

  async summary(
    user: AuthUser,
    query: SummaryQueryDto,
  ): Promise<SummaryResponseDto> {
    const restaurantId = requireRestaurantId(user);
    const to = query.to ?? todayInLuanda();
    const from = query.from ?? dateString(dateAtUtc(to) - 6 * DAY_MS);
    const dayCount = Math.round((dateAtUtc(to) - dateAtUtc(from)) / DAY_MS) + 1;
    if (dayCount < 1 || dayCount > 31)
      throw new BadRequestException('O período deve ter entre 1 e 31 dias');

    return this.dataSource.transaction(async (manager) => {
      const restaurant = await manager.findOne(Restaurant, {
        where: { id: restaurantId },
      });
      if (!restaurant)
        throw new NotFoundException('Restaurante não encontrado');
      const orders = await manager.find(Order, {
        where: { restaurantId, orderDate: Between(from, to) },
      });
      const daily = new Map<string, DailySummaryDto>();
      for (let day = 0; day < dayCount; day++) {
        const date = dateString(dateAtUtc(from) + day * DAY_MS);
        daily.set(date, { date, ordersCount: 0, salesCents: 0 });
      }
      const billableIds: string[] = [];
      for (const order of orders) {
        const row = daily.get(order.orderDate)!;
        row.ordersCount++;
        if (billableStatuses.has(order.status)) {
          row.salesCents += order.totalCents;
          billableIds.push(order.id);
        }
      }
      const items = billableIds.length
        ? await manager.find(OrderItem, { where: { orderId: In(billableIds) } })
        : [];
      const top = new Map<string, TopItemDto>();
      for (const item of items) {
        const key = `${item.menuItemId}\u0000${item.nameSnapshot}`;
        const row = top.get(key) ?? {
          menuItemId: item.menuItemId,
          nameSnapshot: item.nameSnapshot,
          quantity: 0,
          salesCents: 0,
        };
        row.quantity += item.quantity;
        row.salesCents += item.lineTotalCents;
        top.set(key, row);
      }
      const days = [...daily.values()];
      return {
        from,
        to,
        currency: restaurant.currency,
        ordersCount: orders.length,
        salesCents: days.reduce((sum, day) => sum + day.salesCents, 0),
        days,
        topItems: [...top.values()]
          .sort(
            (a, b) =>
              b.quantity - a.quantity ||
              b.salesCents - a.salesCents ||
              a.nameSnapshot.localeCompare(b.nameSnapshot),
          )
          .slice(0, 10),
      };
    });
  }
}
