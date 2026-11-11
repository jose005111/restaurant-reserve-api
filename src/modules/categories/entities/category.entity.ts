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
import { Restaurant } from '../../restaurants/entities/restaurant.entity';

@Entity('categories')
@Unique('uq_categories_restaurant_name', ['restaurantId', 'name'])
@Unique('uq_categories_id_restaurant', ['id', 'restaurantId'])
@Index('idx_categories_menu', ['restaurantId', 'sortOrder'])
export class Category {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'restaurant_id', type: 'uuid' }) restaurantId: string;
  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: Restaurant;
  @Column({ type: 'varchar', length: 100 }) name: string;
  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
