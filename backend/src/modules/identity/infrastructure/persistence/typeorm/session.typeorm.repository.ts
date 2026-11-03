import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { SessionRepository } from '../../../domain/ports/session.repository';
import { Session } from '../../../domain/session';
import { SessionId } from '../../../domain/value-objects/session-id';
import { SessionMapper } from './session.mapper';
import { SessionOrmEntity } from './session.orm-entity';

@Injectable()
export class SessionTypeOrmRepository implements SessionRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async add(session: Session): Promise<void> {
    const manager = await this.connection.manager();
    await manager.insert(SessionOrmEntity, SessionMapper.toOrm(session));
  }

  /** `FOR UPDATE`: must run inside the command's transaction. */
  async findForUpdate(id: SessionId): Promise<Session | null> {
    const manager = await this.connection.manager();
    const entity = await manager.findOne(SessionOrmEntity, { where: { id: id.value }, lock: { mode: 'pessimistic_write' } });
    return entity ? SessionMapper.toDomain(entity) : null;
  }

  async save(session: Session): Promise<void> {
    const manager = await this.connection.manager();
    const { id, tokenDigest, expiresAt, revokedAt, version } = SessionMapper.toOrm(session);
    await manager.update(SessionOrmEntity, { id }, { tokenDigest, expiresAt, revokedAt, version });
  }
}
