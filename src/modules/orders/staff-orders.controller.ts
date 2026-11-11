import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import {
  AcceptOrderDto,
  ChangeOrderStatusDto,
  ListOrdersQueryDto,
  RejectOrderDto,
  StaffOrderPageDto,
  StaffOrderResponseDto,
} from './dto/staff-order.dto';
import { StaffOrdersService } from './staff-orders.service';
import { OrderEventsService } from './order-events.service';
import { requireRestaurantId } from '../../common/utils/tenant.util';

@ApiTags('orders')
@ApiBearerAuth()
@ApiErrors(400, 401, 403, 404, 409, 500)
@Roles(UserRole.ADMIN, UserRole.COUNTER)
@Controller('orders')
export class StaffOrdersController {
  constructor(
    private readonly orders: StaffOrdersService,
    private readonly events: OrderEventsService,
  ) {}

  @Sse('stream')
  @ApiProduces('text/event-stream')
  @ApiResponse({
    status: 200,
    description:
      'Eventos order.created, order.status_changed e heartbeat do restaurante.',
    content: { 'text/event-stream': { schema: { type: 'string' } } },
  })
  stream(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    return this.events.staffStream(requireRestaurantId(user));
  }

  @Get()
  @ApiOkResponse({ type: StaffOrderPageDto })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListOrdersQueryDto,
  ): Promise<StaffOrderPageDto> {
    return this.orders.list(user, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: StaffOrderResponseDto })
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StaffOrderResponseDto> {
    return this.orders.get(user, id);
  }

  @Patch(':id/accept')
  @ApiOkResponse({ type: StaffOrderResponseDto })
  accept(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptOrderDto,
  ): Promise<StaffOrderResponseDto> {
    return this.orders.accept(user, id, dto);
  }

  @Patch(':id/reject')
  @ApiOkResponse({ type: StaffOrderResponseDto })
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectOrderDto,
  ): Promise<StaffOrderResponseDto> {
    return this.orders.reject(user, id, dto);
  }

  @Patch(':id/status')
  @ApiOkResponse({ type: StaffOrderResponseDto })
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeOrderStatusDto,
  ): Promise<StaffOrderResponseDto> {
    return this.orders.setStatus(user, id, dto);
  }
}
