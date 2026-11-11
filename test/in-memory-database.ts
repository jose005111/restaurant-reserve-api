import { Order } from '../src/modules/orders/entities/order.entity';
import { OrderItem } from '../src/modules/orders/entities/order-item.entity';
import { randomUUID } from 'crypto';
import { FindOperator, QueryFailedError } from 'typeorm';
import { DiningTable } from '../src/modules/tables/entities/dining-table.entity';
import { Restaurant } from '../src/modules/restaurants/entities/restaurant.entity';
import { RestaurantBranding } from '../src/modules/branding/entities/restaurant-branding.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { Category } from '../src/modules/categories/entities/category.entity';
import { MenuItem } from '../src/modules/menu/entities/menu-item.entity';
import { MenuItemImage } from '../src/modules/menu/entities/menu-item-image.entity';
import { ThemeMode } from '../src/common/enums/theme-mode.enum';

type Entity =
  | Restaurant
  | RestaurantBranding
  | User
  | DiningTable
  | Category
  | MenuItem
  | MenuItemImage
  | Order
  | OrderItem;
type Constructor<T extends Entity> = new () => T;
type Criteria<T> = {
  where?: Partial<Record<keyof T, unknown>>;
  lock?: { mode: 'pessimistic_write' | 'pessimistic_read' };
  skip?: number;
  take?: number;
  order?: Record<string, 'ASC' | 'DESC'>;
};

export function constraintError(code: '23503' | '23505'): QueryFailedError {
  return new QueryFailedError(
    'test constraint',
    [],
    Object.assign(new Error('Simulated PostgreSQL constraint'), { code }),
  );
}

// These isolated HTTP fixtures emulate basic constraints and serialize transactions.
// Actual SQL, row locks and triggers still require PostgreSQL integration validation.
export class MemoryRepository<T extends Entity> {
  rows: T[] = [];

  constructor(
    private readonly target: Constructor<T>,
    private readonly afterInsert?: (row: T) => void,
    private readonly beforeRemove?: (row: T) => void,
  ) {}

  create(data: Partial<T>): T {
    return Object.assign(new this.target(), data);
  }

  findOne(options: Criteria<T>): Promise<T | null> {
    const row = this.rows.find((item) =>
      this.matches(item, options.where ?? {}),
    );
    return Promise.resolve(row ? this.create(row) : null);
  }

  async findOneOrFail(options: Criteria<T>): Promise<T> {
    const row = await this.findOne(options);
    if (!row) throw new Error('Missing test fixture');
    return row;
  }

  find(options: Criteria<T> = {}): Promise<T[]> {
    const rows = this.rows
      .filter((item) => this.matches(item, options.where ?? {}))
      .map((item) => this.create(item));
    for (const [field, direction] of Object.entries(
      options.order ?? {},
    ).reverse()) {
      const value = (row: T) => {
        const entry = row[field as keyof T];
        return entry instanceof Date
          ? entry.getTime()
          : typeof entry === 'boolean'
            ? Number(entry)
            : typeof entry === 'number'
              ? entry
              : String(entry);
      };
      rows.sort(
        (a, b) =>
          (value(a) < value(b) ? -1 : value(a) > value(b) ? 1 : 0) *
          (direction === 'ASC' ? 1 : -1),
      );
    }
    const skip = options.skip ?? 0;
    return Promise.resolve(
      rows.slice(
        skip,
        options.take === undefined ? undefined : skip + options.take,
      ),
    );
  }

  async findAndCount(options: Criteria<T> = {}): Promise<[T[], number]> {
    const { skip = 0, take, ...unpaged } = options;
    const rows = await this.find(unpaged);
    return [
      rows.slice(skip, take === undefined ? undefined : skip + take),
      rows.length,
    ];
  }

  async count(options: Criteria<T>): Promise<number> {
    return (await this.find({ where: options.where })).length;
  }

  save(entity: T): Promise<T> {
    const row = this.create(entity);
    if (row instanceof RestaurantBranding) {
      Object.assign(row, {
        logoUrl: null,
        logoDarkUrl: null,
        faviconUrl: null,
        bannerUrl: null,
        loginImageUrl: null,
        primaryColor: '#111827',
        secondaryColor: '#6B7280',
        accentColor: '#F59E0B',
        backgroundColor: '#FFFFFF',
        surfaceColor: '#F9FAFB',
        textColor: '#111827',
        themeMode: ThemeMode.LIGHT,
        fontFamily: null,
        borderRadius: 12,
        welcomeTitle: null,
        welcomeMessage: null,
        footerText: null,
        instagramUrl: null,
        facebookUrl: null,
        websiteUrl: null,
        whatsapp: null,
        ...Object.fromEntries(
          Object.entries(entity).filter(([, value]) => value !== undefined),
        ),
      });
    } else if (!row.id) row.id = randomUUID();
    const index = this.rows.findIndex(
      (item) => this.key(item) === this.key(row),
    );
    const now = new Date();
    row.createdAt ??= now;
    if (!(row instanceof MenuItemImage) && !(row instanceof OrderItem))
      row.updatedAt = now;
    const updated = this.rows
      .filter((item) => this.key(item) !== this.key(row))
      .concat(row);
    this.validateConstraints(updated);
    if (index === -1) {
      this.rows.push(row);
      this.afterInsert?.(row);
    } else this.rows[index] = row;
    return Promise.resolve(this.create(row));
  }

  update(criteria: string | Partial<T>, changes: Partial<T>): Promise<void> {
    const rows = this.rows.map((row) =>
      (
        typeof criteria === 'string'
          ? this.key(row) === criteria
          : this.matches(row, criteria)
      )
        ? this.create(Object.assign({}, row, changes))
        : row,
    );
    this.validateConstraints(rows);
    this.rows = rows;
    return Promise.resolve();
  }

  remove(entity: T): Promise<void> {
    this.beforeRemove?.(entity);
    this.rows = this.rows.filter((item) => this.key(item) !== this.key(entity));
    if (!(entity instanceof RestaurantBranding))
      Object.assign(entity, { id: undefined });
    return Promise.resolve();
  }

  createQueryBuilder() {
    let email = '';
    const query = {
      addSelect: () => query,
      where: (sql: string, parameters: { email: string }) => {
        void sql;
        email = parameters.email;
        return query;
      },
      getOne: () =>
        Promise.resolve(
          this.rows.find(
            (row) =>
              row instanceof User &&
              row.email.toLowerCase() === email.toLowerCase(),
          ) ?? null,
        ),
    };
    return query;
  }

  private matches(
    row: T,
    criteria: Partial<Record<keyof T, unknown>>,
  ): boolean {
    return Object.entries(criteria).every(([key, value]) => {
      const actual = row[key as keyof T];
      if (value instanceof FindOperator) {
        if (value.type === 'in')
          return (value.value as readonly unknown[]).includes(actual);
        if (value.type === 'between') {
          const [from, to] = value.value as [string, string];
          return String(actual) >= from && String(actual) <= to;
        }
        if (value.type === 'ilike') {
          // Catalogue queries use escaped literal contains patterns only.
          const encoded = (value.value as string).slice(1, -1);
          let literal = '';
          for (let index = 0; index < encoded.length; index++) {
            if (encoded.charCodeAt(index) === 92 && index + 1 < encoded.length)
              index++;
            literal += encoded[index];
          }
          return String(actual)
            .toLocaleLowerCase()
            .includes(literal.toLocaleLowerCase());
        }
        throw new Error('Unsupported test operator');
      }
      return actual === value;
    });
  }
  private key(row: T): string {
    return row instanceof RestaurantBranding ? row.restaurantId : row.id;
  }
  private validateConstraints(rows: T[]): void {
    const keys = new Set<string>();
    for (const row of rows) {
      const key =
        row instanceof Category
          ? `${row.restaurantId}:${row.name}`
          : row instanceof MenuItemImage && row.isPrimary
            ? row.menuItemId
            : null;
      if (key && keys.has(key)) throw constraintError('23505');
      if (key) keys.add(key);
    }
  }
}

export class MemoryDatabase {
  readonly brandings = new MemoryRepository(RestaurantBranding);
  readonly restaurants = new MemoryRepository(Restaurant, (restaurant) => {
    void this.brandings.save(
      this.brandings.create({ restaurantId: restaurant.id }),
    );
  });
  readonly users = new MemoryRepository(User);
  readonly tables = new MemoryRepository(DiningTable);
  readonly categories = new MemoryRepository(
    Category,
    undefined,
    (category) => {
      if (this.items.rows.some((item) => item.categoryId === category.id))
        throw constraintError('23503');
    },
  );
  readonly protectedMenuItems = new Set<string>();
  readonly items = new MemoryRepository(MenuItem, undefined, (item) => {
    if (
      this.protectedMenuItems.has(item.id) ||
      this.orderItems.rows.some((line) => line.menuItemId === item.id)
    )
      throw constraintError('23503');
    this.images.rows = this.images.rows.filter(
      (image) => image.menuItemId !== item.id,
    );
  });
  readonly images = new MemoryRepository(MenuItemImage);
  readonly orders = new MemoryRepository(Order);
  readonly orderItems = new MemoryRepository(OrderItem);
  private counters: Record<string, number> = {};
  private transactionTail = Promise.resolve();

  getRepository<T extends Entity>(target: Constructor<T>): MemoryRepository<T> {
    const repository =
      target === Restaurant
        ? this.restaurants
        : target === RestaurantBranding
          ? this.brandings
          : target === User
            ? this.users
            : target === DiningTable
              ? this.tables
              : target === Category
                ? this.categories
                : target === MenuItem
                  ? this.items
                  : target === Order
                    ? this.orders
                    : target === OrderItem
                      ? this.orderItems
                      : this.images;
    return repository as unknown as MemoryRepository<T>;
  }

  findOne<T extends Entity>(target: Constructor<T>, options: Criteria<T>) {
    return this.getRepository(target).findOne(options);
  }
  find<T extends Entity>(target: Constructor<T>, options: Criteria<T>) {
    return this.getRepository(target).find(options);
  }
  count<T extends Entity>(target: Constructor<T>, options: Criteria<T>) {
    return this.getRepository(target).count(options);
  }
  create<T extends Entity>(target: Constructor<T>, data: Partial<T>) {
    return this.getRepository(target).create(data);
  }
  save<T extends Entity>(entity: T) {
    return this.getRepository(entity.constructor as Constructor<T>).save(
      entity,
    );
  }
  remove<T extends Entity>(entity: T) {
    return this.getRepository(entity.constructor as Constructor<T>).remove(
      entity,
    );
  }
  update<T extends Entity>(
    target: Constructor<T>,
    criteria: Partial<T>,
    changes: Partial<T>,
  ) {
    return this.getRepository(target).update(criteria, changes);
  }
  query(sql?: string, parameters?: unknown[]) {
    if (sql?.includes('next_order_number')) {
      const day = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Luanda',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const key = `${String(parameters?.[0])}:${day}`;
      const number = (this.counters[key] = (this.counters[key] ?? 0) + 1);
      return Promise.resolve([{ number, order_date: day }]);
    }
    return Promise.resolve([{ result: 1 }]);
  }

  async transaction<T>(
    callback: (manager: MemoryDatabase) => Promise<T>,
  ): Promise<T> {
    const predecessor = this.transactionTail;
    let release!: () => void;
    this.transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await predecessor;
    const repositories = [
      this.restaurants,
      this.users,
      this.tables,
      this.brandings,
      this.categories,
      this.items,
      this.images,
      this.orders,
      this.orderItems,
    ];
    const counterSnapshot = { ...this.counters };
    const snapshots = repositories.map((repository) => repository.rows.slice());
    try {
      return await callback(this);
    } catch (error) {
      this.counters = counterSnapshot;
      repositories.forEach((repository, index) => {
        repository.rows = snapshots[index];
      });
      throw error;
    } finally {
      release();
    }
  }
}
