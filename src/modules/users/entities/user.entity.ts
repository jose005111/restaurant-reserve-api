import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../../common/enums/user-role.enum';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id', type: 'uuid', nullable: true })
  restaurantId: string | null;

  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: Restaurant | null;

  @Column({ name: 'name', type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'email', type: 'varchar', length: 255 })
  email: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash: string;

  @Column({
    name: 'role',
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role',
  })
  role: UserRole;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
