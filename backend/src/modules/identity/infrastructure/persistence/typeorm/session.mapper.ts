import { TokenDigest } from '@shared/domain/value-objects/token-digest';
import { UserId } from '@shared/domain/value-objects/user-id';
import { Session } from '../../../domain/session';
import { SessionId } from '../../../domain/value-objects/session-id';
import { SessionOrmEntity } from './session.orm-entity';

export class SessionMapper {
  static toDomain(entity: SessionOrmEntity): Session {
    return Session.reconstitute({
      id: SessionId.of(entity.id),
      userId: UserId.of(entity.userId),
      tokenDigest: TokenDigest.of(entity.tokenDigest),
      expiresAt: entity.expiresAt,
      revokedAt: entity.revokedAt,
      version: entity.version,
    });
  }

  static toOrm(session: Session): SessionOrmEntity {
    const snapshot = session.snapshot();
    const entity = new SessionOrmEntity();
    entity.id = snapshot.id.value;
    entity.userId = snapshot.userId.value;
    entity.tokenDigest = snapshot.tokenDigest.value;
    entity.expiresAt = snapshot.expiresAt;
    entity.revokedAt = snapshot.revokedAt;
    entity.version = snapshot.version;
    return entity;
  }
}
