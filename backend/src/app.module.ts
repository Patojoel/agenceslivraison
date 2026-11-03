import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from '@config/env.schema';
import { AgenciesModule } from '@modules/agencies/agencies.module';
import { IdentityModule } from '@modules/identity/identity.module';
import { SharedInfrastructureModule } from '@shared/infrastructure/shared-infrastructure.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, ignoreEnvFile: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    SharedInfrastructureModule,
    IdentityModule,
    AgenciesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
