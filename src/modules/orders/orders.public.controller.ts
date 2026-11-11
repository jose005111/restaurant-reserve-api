import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Patch,
  Post,
  Sse,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiProduces,
  ApiResponse,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { CreatePublicOrderDto } from './dto/create-public-order.dto';
import {
  CreatePublicOrderResponseDto,
  PublicOrderResponseDto,
} from './dto/public-order-response.dto';
import { OrdersService } from './orders.service';
import { OrderEventsService } from './order-events.service';
@ApiTags('public-orders')
@Public()
@ApiErrors(403, 404, 429, 500)
@Controller('public/orders')
export class PublicOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly events: OrderEventsService,
  ) {}
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiErrors(400, 409)
  @ApiCreatedResponse({ type: CreatePublicOrderResponseDto })
  create(
    @Body() body: CreatePublicOrderDto,
  ): Promise<CreatePublicOrderResponseDto> {
    return this.orders.create(body);
  }
  @Get(':publicCode')
  @ApiParam({
    name: 'publicCode',
    description: 'Código público aleatório do pedido.',
  })
  @ApiOkResponse({ type: PublicOrderResponseDto })
  get(@Param('publicCode') code: string): Promise<PublicOrderResponseDto> {
    return this.orders.get(code);
  }
  @Sse(':publicCode/stream')
  @ApiParam({
    name: 'publicCode',
    description: 'Código público aleatório do pedido.',
  })
  @ApiProduces('text/event-stream')
  @ApiResponse({
    status: 200,
    description: 'Mudanças de estado e heartbeat deste pedido.',
    content: { 'text/event-stream': { schema: { type: 'string' } } },
  })
  async stream(
    @Param('publicCode') code: string,
  ): Promise<Observable<MessageEvent>> {
    await this.orders.get(code);
    return this.events.publicStream(code);
  }
  @Patch(':publicCode/cancel')
  @ApiParam({
    name: 'publicCode',
    description: 'Código público aleatório do pedido.',
  })
  @ApiErrors(409)
  @ApiOkResponse({ type: PublicOrderResponseDto })
  cancel(@Param('publicCode') code: string): Promise<PublicOrderResponseDto> {
    return this.orders.cancel(code);
  }
}
