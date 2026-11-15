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
import { DiningTable } from '../tables/entities/dining-table.entity';
import {
  DashboardDayDto,
  DashboardResponseDto,
  DashboardStatusCountDto,
} from './dto/dashboard-response.dto';
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

const luandaHourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Luanda',
  hour: '2-digit',
  hourCycle: 'h23',
});

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function minutesBetween(later: Date, earlier: Date): number {
  return Math.max(0, (later.getTime() - earlier.getTime()) / 60_000);
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

  async dashboard(
    user: AuthUser,
    query: SummaryQueryDto,
  ): Promise<DashboardResponseDto> {
    const restaurantId = requireRestaurantId(user);
    const { from, to, dayCount } = this.resolvePeriod(query);

    return this.dataSource.transaction(async (manager) => {
      const restaurant = await manager.findOne(Restaurant, {
        where: { id: restaurantId },
      });
      if (!restaurant)
        throw new NotFoundException('Restaurante não encontrado');
      const orders = await manager.find(Order, {
        where: { restaurantId, orderDate: Between(from, to) },
      });

      const days = new Map<string, DashboardDayDto>();
      for (let day = 0; day < dayCount; day++) {
        const date = dateString(dateAtUtc(from) + day * DAY_MS);
        days.set(date, {
          date,
          ordersCount: 0,
          deliveredCount: 0,
          cancelledCount: 0,
          salesCents: 0,
        });
      }

      const statusCounts = new Map<OrderStatus, DashboardStatusCountDto>();
      for (const status of Object.values(OrderStatus)) {
        statusCounts.set(status, { status, count: 0 });
      }
      const hours = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        ordersCount: 0,
      }));
      const acceptanceDurations: number[] = [];
      const preparationDurations: number[] = [];
      const deliveryDurations: number[] = [];
      let salesCents = 0;
      let billableCount = 0;

      for (const order of orders) {
        statusCounts.get(order.status)!.count++;
        const day = days.get(order.orderDate)!;
        day.ordersCount++;
        hours[Number(luandaHourFormatter.format(order.createdAt))]
          .ordersCount++;

        if (billableStatuses.has(order.status)) {
          day.salesCents += order.totalCents;
          salesCents += order.totalCents;
          billableCount++;
        }
        if (order.status === OrderStatus.DELIVERED) day.deliveredCount++;
        if (
          order.status === OrderStatus.CANCELLED ||
          order.status === OrderStatus.REJECTED
        ) {
          day.cancelledCount++;
        }

        if (order.acceptedAt) {
          acceptanceDurations.push(
            minutesBetween(order.acceptedAt, order.createdAt),
          );
        }
        if (order.acceptedAt && order.readyAt) {
          preparationDurations.push(
            minutesBetween(order.readyAt, order.acceptedAt),
          );
        }
        if (order.readyAt && order.deliveredAt) {
          deliveryDurations.push(
            minutesBetween(order.deliveredAt, order.readyAt),
          );
        }
      }

      const recentOrders = [...orders]
        .sort(
          (a, b) =>
            b.createdAt.getTime() - a.createdAt.getTime() ||
            b.number - a.number,
        )
        .slice(0, 8);
      const tableIds = [
        ...new Set(
          recentOrders
            .map((order) => order.tableId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const tables = tableIds.length
        ? await manager.find(DiningTable, { where: { id: In(tableIds) } })
        : [];
      const tableLabels = new Map(
        tables.map((table) => [table.id, table.label]),
      );
      const statusCount = (status: OrderStatus) =>
        statusCounts.get(status)?.count ?? 0;

      return {
        from,
        to,
        currency: restaurant.currency,
        ordersCount: orders.length,
        activeCount:
          statusCount(OrderStatus.PENDING) +
          statusCount(OrderStatus.ACCEPTED) +
          statusCount(OrderStatus.PREPARING) +
          statusCount(OrderStatus.READY),
        completedCount: statusCount(OrderStatus.DELIVERED),
        cancelledCount: statusCount(OrderStatus.CANCELLED),
        rejectedCount: statusCount(OrderStatus.REJECTED),
        salesCents,
        averageTicketCents:
          billableCount > 0 ? Math.round(salesCents / billableCount) : null,
        averageAcceptanceMinutes: average(acceptanceDurations),
        averagePreparationMinutes: average(preparationDurations),
        averageDeliveryMinutes: average(deliveryDurations),
        statusCounts: [...statusCounts.values()],
        days: [...days.values()],
        hours,
        recentOrders: recentOrders.map((order) => ({
          id: order.id,
          number: order.number,
          tableLabel: tableLabels.get(order.tableId) ?? 'Mesa removida',
          status: order.status,
          guestsCount: order.guestsCount,
          totalCents: order.totalCents,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        })),
      };
    });
  }

  async summary(
    user: AuthUser,
    query: SummaryQueryDto,
  ): Promise<SummaryResponseDto> {
    const restaurantId = requireRestaurantId(user);
    const { from, to, dayCount } = this.resolvePeriod(query);

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

  private resolvePeriod(query: SummaryQueryDto): {
    from: string;
    to: string;
    dayCount: number;
  } {
    const to = query.to ?? todayInLuanda();
    const from = query.from ?? dateString(dateAtUtc(to) - 6 * DAY_MS);
    const dayCount = Math.round((dateAtUtc(to) - dateAtUtc(from)) / DAY_MS) + 1;
    if (dayCount < 1 || dayCount > 31)
      throw new BadRequestException('O período deve ter entre 1 e 31 dias');
    return { from, to, dayCount };
  }
}
