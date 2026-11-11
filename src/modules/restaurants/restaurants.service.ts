import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryDeepPartialEntity, Repository } from 'typeorm';
import { RestaurantPlan } from '../../common/enums/restaurant-plan.enum';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { RestaurantStatus } from '../../common/enums/restaurant-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { isUniqueViolation } from '../../common/utils/database-error.util';
import { hashPassword } from '../../common/utils/password.util';
import { generateSlug } from '../../common/utils/slug.util';
import { generateToken } from '../../common/utils/token.util';
import { User } from '../users/entities/user.entity';
import { DiningTable } from '../tables/entities/dining-table.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Order } from '../orders/entities/order.entity';
import { RestaurantActivityResponseDto } from './dto/restaurant-activity-response.dto';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { PublicSignupDto } from './dto/public-signup.dto';
import { RestaurantResponseDto } from './dto/restaurant-response.dto';
import { UpdateRestaurantStatusDto } from './dto/update-restaurant-status.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { Restaurant } from './entities/restaurant.entity';

interface RestaurantSignupInput {
  name: string;
  slug?: string;
  phone?: string | null;
  address?: string | null;
  currency?: string;
  admin: {
    name: string;
    email: string;
    password: string;
  };
}

interface RestaurantLimits {
  plan: RestaurantPlan;
  subscriptionExpiresAt: Date | null;
  maxTables: number;
  maxMenuItems: number;
  maxUsers: number;
}

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateRestaurantDto): Promise<RestaurantResponseDto> {
    return this.createInternal(dto, {
      plan: dto.plan ?? RestaurantPlan.FREE,
      subscriptionExpiresAt: dto.subscriptionExpiresAt
        ? new Date(dto.subscriptionExpiresAt)
        : null,
      maxTables: dto.maxTables ?? 10,
      maxMenuItems: dto.maxMenuItems ?? 50,
      maxUsers: dto.maxUsers ?? 5,
    });
  }

  async signup(dto: PublicSignupDto): Promise<RestaurantResponseDto> {
    return this.createInternal(dto, {
      plan: RestaurantPlan.FREE,
      subscriptionExpiresAt: null,
      maxTables: 10,
      maxMenuItems: 50,
      maxUsers: 5,
    });
  }

  private async createInternal(
    dto: RestaurantSignupInput,
    limits: RestaurantLimits,
  ): Promise<RestaurantResponseDto> {
    const slug = dto.slug ?? generateSlug(dto.name);

    if (!slug) {
      throw new BadRequestException(
        'Não foi possível gerar um slug válido a partir do nome',
      );
    }

    try {
      const restaurant = await this.dataSource.transaction(async (manager) => {
        const slugExists = await manager.findOne(Restaurant, {
          where: { slug },
        });

        if (slugExists) {
          throw new ConflictException('Slug já está em uso');
        }

        const emailExists = await manager
          .getRepository(User)
          .createQueryBuilder('user')
          .where('LOWER(user.email) = LOWER(:email)', {
            email: dto.admin.email,
          })
          .getOne();

        if (emailExists) {
          throw new ConflictException('Email já está em uso');
        }

        const entity = manager.create(Restaurant, {
          name: dto.name,
          slug,
          phone: dto.phone ?? null,
          address: dto.address ?? null,
          currency: dto.currency ?? 'AOA',
          publicToken: generateToken(),
          status: RestaurantStatus.ACTIVE,
          plan: limits.plan,
          subscriptionExpiresAt: limits.subscriptionExpiresAt,
          maxTables: limits.maxTables,
          maxMenuItems: limits.maxMenuItems,
          maxUsers: limits.maxUsers,
        });

        const saved = await manager.save(entity);

        const admin = manager.create(User, {
          restaurantId: saved.id,
          name: dto.admin.name,
          email: dto.admin.email,
          passwordHash: await hashPassword(dto.admin.password),
          role: UserRole.ADMIN,
          isActive: true,
        });

        await manager.save(admin);

        return saved;
      });

      return this.toResponse(restaurant);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'Slug, token público ou email já estão em uso',
        );
      }

      throw error;
    }
  }

  async findAll(): Promise<RestaurantResponseDto[]> {
    const restaurants = await this.restaurants.find({
      order: { createdAt: 'ASC' },
    });

    return restaurants.map((restaurant) => this.toResponse(restaurant));
  }

  async findOne(id: string): Promise<RestaurantResponseDto> {
    const restaurant = await this.getRestaurantOrFail(id);
    return this.toResponse(restaurant);
  }

  async activity(id: string): Promise<RestaurantActivityResponseDto> {
    await this.getRestaurantOrFail(id);
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [tablesCount, menuItemsCount, activeUsersCount, orders] =
      await Promise.all([
        this.dataSource
          .getRepository(DiningTable)
          .count({ where: { restaurantId: id } }),
        this.dataSource
          .getRepository(MenuItem)
          .count({ where: { restaurantId: id } }),
        this.dataSource
          .getRepository(User)
          .count({ where: { restaurantId: id, isActive: true } }),
        this.dataSource
          .getRepository(Order)
          .createQueryBuilder('orders')
          .select(
            'COUNT(*) FILTER (WHERE orders.created_at >= :since)',
            'ordersCount30Days',
          )
          .addSelect(
            `COALESCE(SUM(orders.total_cents) FILTER (WHERE orders.created_at >= :since AND orders.status IN (:...billableStatuses)), 0)`,
            'salesCents30Days',
          )
          .addSelect('MAX(orders.created_at)', 'lastOrderAt')
          .where('orders.restaurant_id = :id', {
            id,
            since,
            billableStatuses: [
              OrderStatus.ACCEPTED,
              OrderStatus.PREPARING,
              OrderStatus.READY,
              OrderStatus.DELIVERED,
            ],
          })
          .getRawOne<{
            ordersCount30Days: string;
            salesCents30Days: string;
            lastOrderAt: Date | null;
          }>(),
      ]);

    return {
      restaurantId: id,
      tablesCount,
      menuItemsCount,
      activeUsersCount,
      ordersCount30Days: Number(orders?.ordersCount30Days ?? 0),
      salesCents30Days: Number(orders?.salesCents30Days ?? 0),
      lastOrderAt: orders?.lastOrderAt ?? null,
    };
  }

  async update(
    id: string,
    dto: UpdateRestaurantDto,
  ): Promise<RestaurantResponseDto> {
    const restaurant = await this.getRestaurantOrFail(id);

    if (dto.slug && dto.slug !== restaurant.slug) {
      const slugExists = await this.restaurants.findOne({
        where: { slug: dto.slug },
      });

      if (slugExists) {
        throw new ConflictException('Slug já está em uso');
      }
    }

    const changes: QueryDeepPartialEntity<Restaurant> = {};

    if (dto.name !== undefined) {
      changes.name = dto.name;
    }

    if (dto.slug !== undefined) {
      changes.slug = dto.slug;
    }

    if (dto.phone !== undefined) {
      changes.phone = dto.phone;
    }

    if (dto.address !== undefined) {
      changes.address = dto.address;
    }

    if (dto.currency !== undefined) {
      changes.currency = dto.currency;
    }

    if (dto.plan !== undefined) {
      changes.plan = dto.plan;
    }

    if (dto.subscriptionExpiresAt !== undefined) {
      changes.subscriptionExpiresAt = dto.subscriptionExpiresAt
        ? new Date(dto.subscriptionExpiresAt)
        : null;
    }

    if (dto.maxTables !== undefined) {
      changes.maxTables = dto.maxTables;
    }

    if (dto.maxMenuItems !== undefined) {
      changes.maxMenuItems = dto.maxMenuItems;
    }

    if (dto.maxUsers !== undefined) {
      changes.maxUsers = dto.maxUsers;
    }

    try {
      if (Object.keys(changes).length > 0) {
        await this.restaurants.update(restaurant.id, changes);
      }

      const updated = await this.restaurants.findOneOrFail({
        where: { id: restaurant.id },
      });

      return this.toResponse(updated);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Slug já está em uso');
      }

      throw error;
    }
  }

  async updateStatus(
    id: string,
    dto: UpdateRestaurantStatusDto,
  ): Promise<RestaurantResponseDto> {
    const restaurant = await this.getRestaurantOrFail(id);
    restaurant.status = dto.status;
    const updated = await this.restaurants.save(restaurant);
    return this.toResponse(updated);
  }

  async remove(id: string): Promise<void> {
    const restaurant = await this.getRestaurantOrFail(id);
    await this.restaurants.remove(restaurant);
  }

  private async getRestaurantOrFail(id: string): Promise<Restaurant> {
    const restaurant = await this.restaurants.findOne({ where: { id } });

    if (!restaurant) {
      throw new NotFoundException('Restaurante não encontrado');
    }

    return restaurant;
  }

  private toResponse(restaurant: Restaurant): RestaurantResponseDto {
    return {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      phone: restaurant.phone,
      address: restaurant.address,
      currency: restaurant.currency,
      publicToken: restaurant.publicToken,
      status: restaurant.status,
      plan: restaurant.plan,
      subscriptionExpiresAt: restaurant.subscriptionExpiresAt,
      maxTables: restaurant.maxTables,
      maxMenuItems: restaurant.maxMenuItems,
      maxUsers: restaurant.maxUsers,
      createdAt: restaurant.createdAt,
      updatedAt: restaurant.updatedAt,
    };
  }
}
