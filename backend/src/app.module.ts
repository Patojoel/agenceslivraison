import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AgenciesModule } from './modules/agencies/agencies.module';
import { IdentityModule } from './modules/identity/identity.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]), SharedModule, IdentityModule, AgenciesModule],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
