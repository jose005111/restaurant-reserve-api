import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';

@Entity('menu_items')
@Unique('uq_menu_items_id_restaurant', ['id', 'restaurantId'])
@Index('idx_menu_items_menu', ['restaurantId', 'categoryId', 'sortOrder'])
export class MenuItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'restaurant_id', type: 'uuid' }) restaurantId: string;
  @Column({ name: 'category_id', type: 'uuid' }) categoryId: string;
  @ManyToOne(() => Category)
  @JoinColumn([
    { name: 'category_id', referencedColumnName: 'id' },
    { name: 'restaurant_id', referencedColumnName: 'restaurantId' },
  ])
  category: Category;
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ name: 'price_cents', type: 'integer' }) priceCents: number;
  @Column({ name: 'is_available', type: 'boolean', default: true })
  isAvailable: boolean;
  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
