import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryDeepPartialEntity, Repository } from 'typeorm';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { UserRole } from '../../common/enums/user-role.enum';
import { isUniqueViolation } from '../../common/utils/database-error.util';
import { hashPassword } from '../../common/utils/password.util';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(currentUser: AuthUser): Promise<UserResponseDto[]> {
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      const users = await this.users.find({
        order: { createdAt: 'ASC' },
      });

      return users.map((user) => this.toResponse(user));
    }

    if (!currentUser.restaurantId) {
      return [];
    }

    const users = await this.users.find({
      where: { restaurantId: currentUser.restaurantId },
      order: { createdAt: 'ASC' },
    });

    return users.map((user) => this.toResponse(user));
  }

  async findOne(currentUser: AuthUser, id: string): Promise<UserResponseDto> {
    const user = await this.getUserOrFail(currentUser, id);
    return this.toResponse(user);
  }

  async create(
    currentUser: AuthUser,
    dto: CreateUserDto,
  ): Promise<UserResponseDto> {
    const restaurantId = this.resolveRestaurantId(
      currentUser,
      dto.restaurantId,
    );

    try {
      const user = await this.dataSource.transaction(async (manager) => {
        const restaurant = await manager.findOne(Restaurant, {
          where: { id: restaurantId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!restaurant) {
          throw new NotFoundException('Restaurante não encontrado');
        }

        const usersCount = await manager.count(User, {
          where: { restaurantId },
        });

        if (usersCount >= restaurant.maxUsers) {
          throw new ConflictException(
            'Limite de utilizadores do plano atingido',
          );
        }

        const emailExists = await manager
          .getRepository(User)
          .createQueryBuilder('user')
          .where('LOWER(user.email) = LOWER(:email)', { email: dto.email })
          .getOne();

        if (emailExists) {
          throw new ConflictException('Email já está em uso');
        }

        const passwordHash = await hashPassword(dto.password);
        const entity = manager.create(User, {
          restaurantId,
          name: dto.name,
          email: dto.email,
          passwordHash,
          role: dto.role,
          isActive: dto.isActive ?? true,
        });

        return manager.save(entity);
      });

      return this.toResponse(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email já está em uso');
      }

      throw error;
    }
  }

  async update(
    currentUser: AuthUser,
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.getUserOrFail(currentUser, id);

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Não é possível alterar um utilizador SUPER_ADMIN',
      );
    }

    if (dto.email && dto.email !== user.email) {
      const emailExists = await this.users
        .createQueryBuilder('user')
        .where('LOWER(user.email) = LOWER(:email)', { email: dto.email })
        .andWhere('user.id <> :id', { id: user.id })
        .getOne();

      if (emailExists) {
        throw new ConflictException('Email já está em uso');
      }
    }

    const changes: QueryDeepPartialEntity<User> = {};

    if (dto.name !== undefined) {
      changes.name = dto.name;
    }

    if (dto.email !== undefined) {
      changes.email = dto.email;
    }

    if (dto.role !== undefined) {
      changes.role = dto.role;
    }

    if (dto.isActive !== undefined) {
      changes.isActive = dto.isActive;
    }

    if (dto.password) {
      changes.passwordHash = await hashPassword(dto.password);
    }

    try {
      if (Object.keys(changes).length > 0) {
        await this.users.update(user.id, changes);
      }

      const updated = await this.users.findOneOrFail({
        where: { id: user.id },
      });

      return this.toResponse(updated);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email já está em uso');
      }

      throw error;
    }
  }

  async remove(currentUser: AuthUser, id: string): Promise<void> {
    const user = await this.getUserOrFail(currentUser, id);

    if (user.id === currentUser.id) {
      throw new ConflictException(
        'Não é possível remover o próprio utilizador',
      );
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Não é possível remover um utilizador SUPER_ADMIN',
      );
    }

    await this.users.remove(user);
  }

  private async getUserOrFail(
    currentUser: AuthUser,
    id: string,
  ): Promise<User> {
    const user = await this.users.findOne({ where: { id } });

    if (!user || !this.canAccess(currentUser, user)) {
      throw new NotFoundException('Utilizador não encontrado');
    }

    return user;
  }

  private canAccess(currentUser: AuthUser, user: User): boolean {
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    return (
      user.restaurantId !== null &&
      user.restaurantId === currentUser.restaurantId
    );
  }

  private resolveRestaurantId(
    currentUser: AuthUser,
    restaurantId?: string,
  ): string {
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      if (!restaurantId) {
        throw new BadRequestException(
          'O restaurantId é obrigatório para SUPER_ADMIN',
        );
      }

      return restaurantId;
    }

    if (!currentUser.restaurantId) {
      throw new ForbiddenException('Restaurante indisponível');
    }

    if (restaurantId && restaurantId !== currentUser.restaurantId) {
      throw new ForbiddenException('Acesso negado');
    }

    return currentUser.restaurantId;
  }

  private toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      restaurantId: user.restaurantId,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
