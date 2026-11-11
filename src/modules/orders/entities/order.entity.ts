import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';
import { DiningTable } from '../../tables/entities/dining-table.entity';
import { OrderStatus } from '../../../common/enums/order-status.enum';
@Entity('orders')
@Unique('uq_orders_public_code', ['publicCode'])
@Unique('uq_orders_daily_number', ['restaurantId', 'orderDate', 'number'])
@Unique('uq_orders_idempotency', ['restaurantId', 'idempotencyKey'])
@Unique('uq_orders_id_restaurant', ['id', 'restaurantId'])
export class Order {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'restaurant_id', type: 'uuid' }) restaurantId: string;
  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: Restaurant;
  @Column({ name: 'table_id', type: 'uuid' }) tableId: string;
  @ManyToOne(() => DiningTable)
  @JoinColumn([
    { name: 'table_id', referencedColumnName: 'id' },
    { name: 'restaurant_id', referencedColumnName: 'restaurantId' },
  ])
  table: DiningTable;
  @Column({
    name: 'order_date',
    type: 'date',
    default: () => "((now() AT TIME ZONE 'Africa/Luanda')::date)",
  })
  orderDate: string;
  @Column({ type: 'integer' }) number: number;
  @Column({ name: 'public_code', type: 'varchar', length: 32 })
  publicCode: string;
  @Column({ name: 'guests_count', type: 'smallint' }) guestsCount: number;
  @Column({
    name: 'customer_note',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  customerNote: string | null;
  @Column({
    type: 'enum',
    enum: OrderStatus,
    enumName: 'order_status',
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;
  @Column({ name: 'estimated_prep_minutes', type: 'smallint', nullable: true })
  estimatedPrepMinutes: number | null;
  @Column({ name: 'staff_note', type: 'varchar', length: 500, nullable: true })
  staffNote: string | null;
  @Column({
    name: 'rejection_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  rejectionReason: string | null;
  @Column({ name: 'total_cents', type: 'integer', default: 0 })
  totalCents: number;
  @Column({ name: 'idempotency_key', type: 'varchar', length: 100 })
  idempotencyKey: string;
  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;
  @Column({ name: 'ready_at', type: 'timestamptz', nullable: true })
  readyAt: Date | null;
  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
