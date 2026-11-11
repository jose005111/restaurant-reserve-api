import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class PublicThrottlerGuard extends ThrottlerGuard {
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return Promise.resolve(!isPublic);
  }
}
