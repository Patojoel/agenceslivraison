import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Env, validateEnv } from '@config/env.schema';
import { AgenciesModule } from '@modules/agencies/agencies.module';
import { IdentityModule } from '@modules/identity/identity.module';
import { MarketplaceModule } from '@modules/marketplace/marketplace.module';
import { PricingModule } from '@modules/pricing/pricing.module';
import { SharedInfrastructureModule } from '@shared/infrastructure/shared-infrastructure.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, ignoreEnvFile: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [{ ttl: 60000, limit: config.get('RATE_LIMIT_DEFAULT_PER_MINUTE', { infer: true }) }],
    }),
    SharedInfrastructureModule,
    IdentityModule,
    AgenciesModule,
    PricingModule,
    MarketplaceModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
