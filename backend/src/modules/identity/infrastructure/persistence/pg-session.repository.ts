import { Database } from '../../../../shared/infrastructure/db/database';
import { TokenDigest } from '../../../../shared/domain/vo/token-digest';
import { UserId } from '../../../../shared/domain/vo/user-id';
import { Session } from '../../domain/model/session';
import { SessionRepository } from '../../domain/repositories/session.repository';
import { SessionId } from '../../domain/vo/session-id';

type SessionRow = { id: string; user_id: string; token_digest: string; expires_at: Date; revoked_at: Date | null; version: number };

export class PgSessionRepository implements SessionRepository {
  constructor(private readonly database: Database) {}

  async add(session: Session): Promise<void> {
    const state = session.snapshot();
    await this.database.execute(
      'INSERT INTO sessions (id, user_id, token_digest, expires_at, revoked_at, version) VALUES ($1, $2, $3, $4, $5, $6)',
      [state.id.value, state.userId.value, state.tokenDigest.value, state.expiresAt, state.revokedAt, state.version],
    );
  }

  async findForUpdate(id: SessionId): Promise<Session | null> {
    const [row] = await this.database.query<SessionRow>(
      'SELECT id, user_id, token_digest, expires_at, revoked_at, version FROM sessions WHERE id = $1 FOR UPDATE', [id.value],
    );
    if (!row) return null;
    return Session.reconstitute({
      id: SessionId.of(row.id), userId: UserId.of(row.user_id), tokenDigest: TokenDigest.of(row.token_digest),
      expiresAt: row.expires_at, revokedAt: row.revoked_at, version: row.version,
    });
  }

  async save(session: Session): Promise<void> {
    const state = session.snapshot();
    await this.database.execute(
      'UPDATE sessions SET token_digest = $1, expires_at = $2, revoked_at = $3, version = $4 WHERE id = $5',
      [state.tokenDigest.value, state.expiresAt, state.revokedAt, state.version, state.id.value],
    );
  }
}
