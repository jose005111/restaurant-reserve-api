import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { MenuItem } from '../../menu/entities/menu-item.entity';
@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'order_id', type: 'uuid' }) orderId: string;
  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;
  @Column({ name: 'menu_item_id', type: 'uuid' }) menuItemId: string;
  @ManyToOne(() => MenuItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'menu_item_id' })
  menuItem: MenuItem;
  @Column({ name: 'name_snapshot', type: 'varchar', length: 150 })
  nameSnapshot: string;
  @Column({ name: 'unit_price_cents', type: 'integer' }) unitPriceCents: number;
  @Column({ type: 'smallint' }) quantity: number;
  @Column({ type: 'varchar', length: 255, nullable: true }) note: string | null;
  @Column({ name: 'line_total_cents', type: 'integer' }) lineTotalCents: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
