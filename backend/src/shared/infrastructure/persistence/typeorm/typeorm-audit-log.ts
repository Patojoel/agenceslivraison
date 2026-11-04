import { Inject, Injectable } from '@nestjs/common';
import { AuditEntry, AuditLog } from '../../../application/ports/audit-log.port';
import { UUID_GENERATOR, UuidGenerator } from '../../../domain/ports/uuid-generator.port';
import { AuditLogOrmEntity } from './audit-log.orm-entity';
import { TypeOrmDatabaseConnection } from './typeorm-database-connection';

@Injectable()
export class TypeOrmAuditLog implements AuditLog {
  constructor(
    private readonly connection: TypeOrmDatabaseConnection,
    @Inject(UUID_GENERATOR) private readonly uuid: UuidGenerator,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    const manager = await this.connection.manager();
    await manager.insert(AuditLogOrmEntity, {
      id: this.uuid.generate(),
      userId: entry.userId,
      action: entry.action,
      agencyId: entry.agencyId ?? null,
      subjectUserId: entry.subjectUserId ?? null,
      details: entry.details ? { fields: [...entry.details.fields] } : null,
    });
  }
}
