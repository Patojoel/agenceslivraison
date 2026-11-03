import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { SessionRuleError, Session } from '../domain/sessions';
import { SessionRepository } from './session-repository';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const secretPattern = /^[A-Za-z0-9_-]{43}$/;
function digest(secret: string): string { return createHash('sha256').update(secret).digest('hex'); }
function parseToken(token: string): { id: string; secret: string } | null {
  const parts = token.split('.');
  return parts.length === 2 && uuidPattern.test(parts[0]) && secretPattern.test(parts[1]) ? { id: parts[0], secret: parts[1] } : null;
}
function secret(): string { return randomBytes(32).toString('base64url'); }

/** Internal service: callers must authenticate before issuing sessions. */
export class SessionService {
  private readonly repository: SessionRepository;
  constructor(private readonly pool: Pool, private readonly ttlMs: number) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw new Error('Invalid session duration');
    this.repository = new SessionRepository(pool);
  }
  async issue(userId: string, now: number): Promise<{ refreshToken: string; expiresAt: number }> {
    const id = randomUUID();
    const value = secret();
    const expiresAt = now + this.ttlMs;
    if (!Number.isSafeInteger(now) || !Number.isSafeInteger(expiresAt)) throw new Error('Invalid time');
    await this.pool.query('INSERT INTO sessions (id, user_id, token_digest, expires_at) VALUES ($1, $2, $3, $4)', [id, userId, digest(value), new Date(expiresAt)]);
    return { refreshToken: `${id}.${value}`, expiresAt };
  }
  async refresh(token: string, now: number): Promise<{ refreshToken: string; expiresAt: number } | null> {
    const parsed = parseToken(token);
    if (!parsed || !Number.isSafeInteger(now) || !Number.isSafeInteger(now + this.ttlMs)) return null;
    const result = await this.pool.query<{ id: string; user_id: string; token_digest: string; expires_at: Date; revoked_at: Date | null; version: number }>(
      'SELECT id, user_id, token_digest, expires_at, revoked_at, version FROM sessions WHERE id = $1', [parsed.id],
    );
    const row = result.rows[0];
    if (!row) return null;
    const current: Session = { id: row.id, userId: row.user_id, tokenDigest: row.token_digest, expiresAt: row.expires_at.getTime(), revokedAt: row.revoked_at?.getTime() ?? null, version: row.version };
    const next = secret();
    try {
      const updated = await this.repository.rotate(current, digest(parsed.secret), digest(next), now, now + this.ttlMs);
      return updated ? { refreshToken: `${parsed.id}.${next}`, expiresAt: now + this.ttlMs } : null;
    } catch (error) {
      if (error instanceof SessionRuleError) return null;
      throw error;
    }
  }
  async logout(token: string, now: number): Promise<boolean> {
    const parsed = parseToken(token);
    if (!parsed || !Number.isSafeInteger(now)) return false;
    const result = await this.pool.query(
      'UPDATE sessions SET revoked_at = $1, version = version + 1 WHERE id = $2 AND token_digest = $3 AND revoked_at IS NULL',
      [new Date(now), parsed.id, digest(parsed.secret)],
    );
    return result.rowCount === 1;
  }
}
