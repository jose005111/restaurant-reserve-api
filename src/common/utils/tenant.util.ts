import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../../modules/auth/interfaces/auth-user.interface';

export function requireRestaurantId(user: AuthUser): string {
  if (!user.restaurantId)
    throw new ForbiddenException('Restaurante indisponível');
  return user.restaurantId;
}
