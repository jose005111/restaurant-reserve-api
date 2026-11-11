import { ConflictException } from '@nestjs/common';
import { OrderStatus } from '../../common/enums/order-status.enum';
export type OrderAction = 'clientCancel' | 'accept' | 'reject' | 'status';
const transitions: Record<
  OrderAction,
  Partial<Record<OrderStatus, readonly OrderStatus[]>>
> = {
  clientCancel: { [OrderStatus.PENDING]: [OrderStatus.CANCELLED] },
  accept: { [OrderStatus.PENDING]: [OrderStatus.ACCEPTED] },
  reject: { [OrderStatus.PENDING]: [OrderStatus.REJECTED] },
  status: {
    [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
    [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
    [OrderStatus.READY]: [OrderStatus.DELIVERED],
  },
};
export function transitionOrder(
  from: OrderStatus,
  to: OrderStatus,
  action: OrderAction,
): OrderStatus {
  if (!transitions[action][from]?.includes(to))
    throw new ConflictException(
      action === 'clientCancel'
        ? 'O pedido já não pode ser cancelado'
        : `Não é possível mudar o pedido de ${from} para ${to}`,
    );
  return to;
}
export function transitionClientOrder(
  from: OrderStatus,
  to: OrderStatus,
): OrderStatus {
  return transitionOrder(from, to, 'clientCancel');
}
