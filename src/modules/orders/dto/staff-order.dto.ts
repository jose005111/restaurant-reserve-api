import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { OrderStatus } from '../../../common/enums/order-status.enum';
import { OptionalField } from '../../../common/decorators/optional-field.decorator';
import {
  PaginationMetaDto,
  PaginationQueryDto,
} from '../../../common/dto/pagination.dto';
import { emptyToUndefined } from '../../../common/utils/input.util';
import { PublicOrderItemResponseDto } from './public-order-response.dto';

export class ListOrdersQueryDto extends PickType(PaginationQueryDto, [
  'page',
  'limit',
] as const) {
  @ApiPropertyOptional({ enum: OrderStatus })
  @OptionalField()
  @IsEnum(OrderStatus, { message: 'Estado inválido' })
  status?: OrderStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalField()
  @IsUUID('all', { message: 'tableId deve ser um UUID válido' })
  tableId?: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-11-10' })
  @OptionalField()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data inválida' })
  @IsDateString({}, { message: 'Data inválida' })
  date?: string;
}

export class AcceptOrderDto {
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 240 })
  @IsInt({ message: 'O tempo estimado deve ser um inteiro' })
  @Min(1)
  @Max(240)
  estimatedPrepMinutes: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(({ value }: { value: unknown }) => emptyToUndefined(value))
  @OptionalField()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectOrderDto {
  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1, { message: 'Indica o motivo da rejeição' })
  @MaxLength(255)
  reason: string;
}

export class ChangeOrderStatusDto {
  @ApiProperty({
    enum: [
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
    ],
  })
  @IsEnum(
    [
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
    ],
    { message: 'Estado inválido' },
  )
  status:
    | OrderStatus.PREPARING
    | OrderStatus.READY
    | OrderStatus.DELIVERED
    | OrderStatus.CANCELLED;
}

export class StaffOrderResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) tableId: string;
  @ApiProperty() tableLabel: string;
  @ApiProperty({ type: 'integer' }) number: number;
  @ApiProperty({ format: 'date' }) orderDate: string;
  @ApiProperty({ enum: OrderStatus }) status: OrderStatus;
  @ApiProperty({ type: 'integer' }) guestsCount: number;
  @ApiProperty({ type: String, nullable: true }) customerNote: string | null;
  @ApiProperty({ type: [PublicOrderItemResponseDto] })
  items: PublicOrderItemResponseDto[];
  @ApiProperty({ type: 'integer' }) totalCents: number;
  @ApiProperty({ type: 'integer', nullable: true }) estimatedPrepMinutes:
    number | null;
  @ApiProperty({ type: String, nullable: true }) staffNote: string | null;
  @ApiProperty({ type: String, nullable: true }) rejectionReason: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt: Date;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  acceptedAt: Date | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readyAt: Date | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  deliveredAt: Date | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  cancelledAt: Date | null;
}

export class StaffOrderPageDto {
  @ApiProperty({ type: [StaffOrderResponseDto] })
  items: StaffOrderResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta: PaginationMetaDto;
}
