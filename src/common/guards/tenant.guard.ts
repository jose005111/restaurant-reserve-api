import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '../../modules/auth/interfaces/auth-user.interface';
import { RestaurantAvailabilityService } from '../../modules/restaurants/restaurant-availability.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserRole } from '../enums/user-role.enum';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly restaurantAvailability: RestaurantAvailabilityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    if (!user || user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    if (!user.restaurantId) {
      throw new ForbiddenException('Restaurante indisponível');
    }

    await this.restaurantAvailability.assertAvailable(user.restaurantId);

    return true;
  }
}
