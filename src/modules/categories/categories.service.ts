import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import { paginationMeta } from '../../common/dto/pagination.dto';
import { escapeLike } from '../../common/utils/search.util';
import { CategoryPageDto } from './dto/category-page.dto';
import { ListCategoriesQueryDto } from './dto/list-categories-query.dto';
import {
  isForeignKeyViolation,
  isUniqueViolation,
} from '../../common/utils/database-error.util';
import { requireRestaurantId } from '../../common/utils/tenant.util';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  async findAll(
    user: AuthUser,
    query: ListCategoriesQueryDto = new ListCategoriesQueryDto(),
  ): Promise<CategoryPageDto> {
    const { page, limit, search, isActive } = query;
    const where: FindOptionsWhere<Category> = {
      restaurantId: requireRestaurantId(user),
    };
    if (search) where.name = ILike(`%${escapeLike(search)}%`);
    if (isActive !== undefined) where.isActive = isActive;
    const [categories, total] = await this.categories.findAndCount({
      where,
      order: { sortOrder: 'ASC', createdAt: 'ASC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items: categories.map((category) => this.toResponse(category)),
      meta: paginationMeta(total, page, limit),
    };
  }

  async findOne(user: AuthUser, id: string): Promise<CategoryResponseDto> {
    return this.toResponse(await this.getEntity(user, id));
  }

  async create(
    user: AuthUser,
    dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    try {
      const category = await this.categories.save(
        this.categories.create({
          restaurantId: requireRestaurantId(user),
          name: dto.name,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
        }),
      );
      return this.toResponse(category);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('Já existe uma categoria com este nome');
      throw error;
    }
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.getEntity(user, id);
    if (dto.name !== undefined) category.name = dto.name;
    if (dto.sortOrder !== undefined) category.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) category.isActive = dto.isActive;
    try {
      return this.toResponse(await this.categories.save(category));
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('Já existe uma categoria com este nome');
      throw error;
    }
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const category = await this.getEntity(user, id);
    try {
      await this.categories.remove(category);
    } catch (error) {
      if (isForeignKeyViolation(error))
        throw new ConflictException(
          'A categoria tem pratos associados e não pode ser removida',
        );
      throw error;
    }
  }

  private async getEntity(user: AuthUser, id: string): Promise<Category> {
    const category = await this.categories.findOne({
      where: { id, restaurantId: requireRestaurantId(user) },
    });
    if (!category) throw new NotFoundException('Categoria não encontrada');
    return category;
  }

  private toResponse(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      restaurantId: category.restaurantId,
      name: category.name,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}
