import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Env } from '@config/env.schema';
import { buildTypeOrmOptions } from '@config/typeorm.config';
import { AUDIT_LOG } from '@shared/application/ports/audit-log.port';
import { DOMAIN_EVENT_PUBLISHER } from '@shared/application/ports/domain-event-publisher.port';
import { IDEMPOTENCY_KEYS } from '@shared/application/ports/idempotency-keys.port';
import { TOKEN_SECRETS } from '@shared/application/ports/token-secrets.port';
import { CLOCK } from '@shared/domain/ports/clock.port';
import { UUID_GENERATOR } from '@shared/domain/ports/uuid-generator.port';
import { HealthController } from '@shared/presentation/health/health.controller';
import { SystemClock } from './clock/system-clock';
import { Sha256TokenSecrets } from './crypto/sha256-token-secrets';
import { InProcessDomainEventPublisher } from './events/in-process-domain-event-publisher';
import { TransactionalCommandHandlerFactory } from './persistence/typeorm/transactional-command-handler.factory';
import { TypeOrmIdempotencyKeys } from './persistence/typeorm/typeorm-idempotency-keys';
import { TypeOrmAuditLog } from './persistence/typeorm/typeorm-audit-log';
import { TypeOrmDatabaseConnection } from './persistence/typeorm/typeorm-database-connection';
import { CryptoUuidGenerator } from './uuid/crypto-uuid-generator';

const exported = [
  TypeOrmDatabaseConnection,
  TransactionalCommandHandlerFactory,
  InProcessDomainEventPublisher,
  { provide: CLOCK, useClass: SystemClock },
  { provide: UUID_GENERATOR, useClass: CryptoUuidGenerator },
  { provide: TOKEN_SECRETS, useClass: Sha256TokenSecrets },
  { provide: DOMAIN_EVENT_PUBLISHER, useExisting: InProcessDomainEventPublisher },
  { provide: AUDIT_LOG, useClass: TypeOrmAuditLog },
  { provide: IDEMPOTENCY_KEYS, useClass: TypeOrmIdempotencyKeys },
];

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => buildTypeOrmOptions(config),
    }),
  ],
  controllers: [HealthController],
  providers: exported,
  exports: exported,
})
export class SharedInfrastructureModule {}
