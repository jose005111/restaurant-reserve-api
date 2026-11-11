import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RestaurantPlan } from '../../../common/enums/restaurant-plan.enum';
import { RestaurantStatus } from '../../../common/enums/restaurant-status.enum';

@Entity('restaurants')
export class Restaurant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'slug', type: 'varchar', length: 80 })
  slug: string;

  @Column({ name: 'phone', type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ name: 'address', type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({ name: 'currency', type: 'char', length: 3, default: 'AOA' })
  currency: string;

  @Column({ name: 'public_token', type: 'varchar', length: 64 })
  publicToken: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: RestaurantStatus,
    enumName: 'restaurant_status',
    default: RestaurantStatus.ACTIVE,
  })
  status: RestaurantStatus;

  @Column({
    name: 'plan',
    type: 'enum',
    enum: RestaurantPlan,
    enumName: 'restaurant_plan',
    default: RestaurantPlan.FREE,
  })
  plan: RestaurantPlan;

  @Column({
    name: 'subscription_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  subscriptionExpiresAt: Date | null;

  @Column({ name: 'max_tables', type: 'integer', default: 10 })
  maxTables: number;

  @Column({ name: 'max_menu_items', type: 'integer', default: 50 })
  maxMenuItems: number;

  @Column({ name: 'max_users', type: 'integer', default: 5 })
  maxUsers: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
