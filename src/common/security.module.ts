import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { PublicThrottlerGuard } from './guards/public-throttler.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 60 }],
      errorMessage: 'Demasiados pedidos. Tente novamente mais tarde.',
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: PublicThrottlerGuard }],
})
export class SecurityModule {}
