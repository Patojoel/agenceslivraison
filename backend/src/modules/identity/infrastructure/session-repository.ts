import { Pool } from 'pg';
import { rotateSession, Session } from '../domain/sessions';

/** The database update is a compare-and-swap: only one refresh may use a version. */
export class SessionRepository {
  constructor(private readonly pool: Pool) {}

  async rotate(current: Session, presentedDigest: string, nextDigest: string, now: number, expiresAt: number): Promise<boolean> {
    const next = rotateSession(current, presentedDigest, nextDigest, current.version, now, expiresAt);
    const result = await this.pool.query(
      `UPDATE sessions SET token_digest = $1, expires_at = $2, version = $3
       WHERE id = $4 AND user_id = $5 AND version = $6 AND token_digest = $7
         AND revoked_at IS NULL AND expires_at > $8`,
      [next.tokenDigest, new Date(next.expiresAt), next.version, current.id, current.userId,
        current.version, current.tokenDigest, new Date(now)],
    );
    return result.rowCount === 1;
  }

  async revoke(id: string, userId: string, now: number): Promise<boolean> {
    if (!Number.isFinite(now)) throw new Error('Invalid time');
    const result = await this.pool.query(
      'UPDATE sessions SET revoked_at = $1, version = version + 1 WHERE id = $2 AND user_id = $3 AND revoked_at IS NULL',
      [new Date(now), id, userId],
    );
    return result.rowCount === 1;
  }
}
