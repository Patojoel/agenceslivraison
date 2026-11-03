import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { OpenSessionCriteria, ReadSessionRepository } from '../../../application/ports/read-session.repository';
import { AuthenticatedUser } from '../../../application/read-models/authenticated-user.read-model';
import { SessionOrmEntity } from './session.orm-entity';
import { UserOrmEntity } from './user.orm-entity';

@Injectable()
export class ReadSessionTypeOrmRepository implements ReadSessionRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async findOpenSessionUser(criteria: OpenSessionCriteria): Promise<AuthenticatedUser | null> {
    const manager = await this.connection.manager();
    const row = await manager
      .createQueryBuilder(SessionOrmEntity, 'session')
      .innerJoin(UserOrmEntity, 'account', 'account.id = session.userId')
      .select('account.id', 'id')
      .addSelect('account.email', 'email')
      .addSelect('account.accountType', 'accountType')
      .where('session.id = :sessionId', { sessionId: criteria.sessionId })
      .andWhere('session.userId = :userId', { userId: criteria.userId })
      .andWhere('session.revokedAt IS NULL')
      .andWhere('session.expiresAt > :now', { now: criteria.now })
      .getRawOne<{ id: string; email: string | null; accountType: string | null }>();
    return row ? { id: row.id, email: row.email, accountType: row.accountType } : null;
  }
}
