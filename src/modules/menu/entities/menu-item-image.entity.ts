import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MenuItem } from './menu-item.entity';

@Entity('menu_item_images')
@Index('idx_menu_item_images_item', ['menuItemId', 'sortOrder'])
@Index('uq_menu_item_images_primary', ['menuItemId'], {
  unique: true,
  where: 'is_primary',
})
export class MenuItemImage {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'restaurant_id', type: 'uuid' }) restaurantId: string;
  @Column({ name: 'menu_item_id', type: 'uuid' }) menuItemId: string;
  @ManyToOne(() => MenuItem, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'menu_item_id', referencedColumnName: 'id' },
    { name: 'restaurant_id', referencedColumnName: 'restaurantId' },
  ])
  menuItem: MenuItem;
  @Column({ type: 'varchar', length: 500 }) url: string;
  @Column({ name: 'storage_key', type: 'varchar', length: 300, nullable: true })
  storageKey: string | null;
  @Column({ name: 'alt_text', type: 'varchar', length: 150, nullable: true })
  altText: string | null;
  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;
  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
