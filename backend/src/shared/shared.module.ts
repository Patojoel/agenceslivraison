import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { AUDIT_LOG } from './application/ports/audit-log';
import { CLOCK } from './application/ports/clock';
import { DOMAIN_EVENT_PUBLISHER } from './application/ports/domain-events';
import { ID_GENERATOR, IdGenerator } from './application/ports/id-generator';
import { SQL_READER } from './application/ports/sql-reader';
import { TOKEN_SECRETS } from './application/ports/token-secrets';
import { PgAuditLog } from './infrastructure/audit/pg-audit-log';
import { Sha256TokenSecrets } from './infrastructure/crypto/sha256-token-secrets';
import { createPool, DATABASE_POOL } from './infrastructure/db/create-pool';
import { Database } from './infrastructure/db/database';
import { TransactionalCommandHandlerFactory } from './infrastructure/db/transactional-command-handler.factory';
import { InProcessDomainEventPublisher } from './infrastructure/events/in-process-domain-event-publisher';
import { HealthController } from './infrastructure/health/health.controller';
import { RandomUuidGenerator } from './infrastructure/system/random-uuid-generator';
import { SystemClock } from './infrastructure/system/system-clock';

@Global()
@Module({
  controllers: [HealthController],
  providers: [
    { provide: DATABASE_POOL, useFactory: createPool },
    { provide: Database, useFactory: (pool: Pool) => new Database(pool), inject: [DATABASE_POOL] },
    { provide: SQL_READER, useExisting: Database },
    { provide: TransactionalCommandHandlerFactory, useFactory: (database: Database) => new TransactionalCommandHandlerFactory(database), inject: [Database] },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: RandomUuidGenerator },
    { provide: TOKEN_SECRETS, useClass: Sha256TokenSecrets },
    { provide: InProcessDomainEventPublisher, useClass: InProcessDomainEventPublisher },
    { provide: DOMAIN_EVENT_PUBLISHER, useExisting: InProcessDomainEventPublisher },
    { provide: AUDIT_LOG, useFactory: (database: Database, ids: IdGenerator) => new PgAuditLog(database, ids), inject: [Database, ID_GENERATOR] },
  ],
  exports: [DATABASE_POOL, Database, SQL_READER, TransactionalCommandHandlerFactory, CLOCK, ID_GENERATOR, TOKEN_SECRETS, InProcessDomainEventPublisher, DOMAIN_EVENT_PUBLISHER, AUDIT_LOG],
})
export class SharedModule {}
