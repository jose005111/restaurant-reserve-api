import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import QRCode from 'qrcode';
import { DataSource, Repository } from 'typeorm';
import {
  isForeignKeyViolation,
  isUniqueViolation,
} from '../../common/utils/database-error.util';
import { generateToken } from '../../common/utils/token.util';
import { appConfig } from '../../config';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { CreateDiningTableDto } from './dto/create-dining-table.dto';
import { DiningTableResponseDto } from './dto/dining-table-response.dto';
import { TableQrResponseDto } from './dto/table-qr-response.dto';
import { UpdateDiningTableDto } from './dto/update-dining-table.dto';
import { DiningTable } from './entities/dining-table.entity';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(DiningTable)
    private readonly tables: Repository<DiningTable>,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(currentUser: AuthUser): Promise<DiningTableResponseDto[]> {
    const restaurantId = this.requireRestaurantId(currentUser);
    const tables = await this.tables.find({
      where: { restaurantId },
      order: { createdAt: 'ASC' },
    });

    return tables.map((table) => this.toResponse(table));
  }

  async findOne(
    currentUser: AuthUser,
    id: string,
  ): Promise<DiningTableResponseDto> {
    const table = await this.getTableOrFail(currentUser, id);
    return this.toResponse(table);
  }

  async create(
    currentUser: AuthUser,
    dto: CreateDiningTableDto,
  ): Promise<DiningTableResponseDto> {
    const restaurantId = this.requireRestaurantId(currentUser);

    try {
      const table = await this.dataSource.transaction(async (manager) => {
        const restaurant = await manager.findOne(Restaurant, {
          where: { id: restaurantId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!restaurant) {
          throw new NotFoundException('Restaurante não encontrado');
        }

        const tablesCount = await manager.count(DiningTable, {
          where: { restaurantId },
        });

        if (tablesCount >= restaurant.maxTables) {
          throw new ConflictException('Limite de mesas do plano atingido');
        }

        const entity = manager.create(DiningTable, {
          restaurantId,
          label: dto.label,
          qrToken: generateToken(),
          isActive: true,
        });

        return manager.save(entity);
      });

      return this.toResponse(table);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Já existe uma mesa com este label');
      }

      throw error;
    }
  }

  async update(
    currentUser: AuthUser,
    id: string,
    dto: UpdateDiningTableDto,
  ): Promise<DiningTableResponseDto> {
    const table = await this.getTableOrFail(currentUser, id);

    try {
      if (dto.label !== undefined) {
        table.label = dto.label;
      }

      if (dto.isActive !== undefined) {
        table.isActive = dto.isActive;
      }

      const updated = await this.tables.save(table);
      return this.toResponse(updated);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Já existe uma mesa com este label');
      }

      throw error;
    }
  }

  async remove(currentUser: AuthUser, id: string): Promise<void> {
    const table = await this.getTableOrFail(currentUser, id);

    try {
      await this.tables.remove(table);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'A mesa tem pedidos associados e não pode ser removida',
        );
      }

      throw error;
    }
  }

  async rotateToken(
    currentUser: AuthUser,
    id: string,
  ): Promise<DiningTableResponseDto> {
    const table = await this.getTableOrFail(currentUser, id);
    table.qrToken = generateToken();
    const updated = await this.tables.save(table);
    return this.toResponse(updated);
  }

  async getQr(currentUser: AuthUser, id: string): Promise<TableQrResponseDto> {
    const table = await this.getTableOrFail(currentUser, id);
    const url = this.buildPublicUrl(table.qrToken);
    const qrCode = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 512,
    });

    return {
      tableId: table.id,
      label: table.label,
      url,
      qrCode,
    };
  }

  private async getTableOrFail(
    currentUser: AuthUser,
    id: string,
  ): Promise<DiningTable> {
    const restaurantId = this.requireRestaurantId(currentUser);
    const table = await this.tables.findOne({ where: { id } });

    if (!table || table.restaurantId !== restaurantId) {
      throw new NotFoundException('Mesa não encontrada');
    }

    return table;
  }

  private requireRestaurantId(currentUser: AuthUser): string {
    if (!currentUser.restaurantId) {
      throw new ForbiddenException('Restaurante indisponível');
    }

    return currentUser.restaurantId;
  }

  private buildPublicUrl(token: string): string {
    return `${this.app.publicMenuBaseUrl}/${token}`;
  }

  private toResponse(table: DiningTable): DiningTableResponseDto {
    return {
      id: table.id,
      restaurantId: table.restaurantId,
      label: table.label,
      qrToken: table.qrToken,
      isActive: table.isActive,
      createdAt: table.createdAt,
      updatedAt: table.updatedAt,
    };
  }
}
