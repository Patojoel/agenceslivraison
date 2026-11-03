import { timingSafeEqual } from 'node:crypto';

/** Persistence must apply rotation with a version-checked atomic update. */
export interface Session {
  readonly id: string;
  readonly userId: string;
  readonly tokenDigest: string;
  readonly expiresAt: number;
  readonly revokedAt: number | null;
  readonly version: number;
}
export class SessionRuleError extends Error {}
export function isUsableSession(session: Session, now: number): boolean {
  return Number.isFinite(now) && session.revokedAt === null && now < session.expiresAt;
}
function digestBytes(digest: string): Buffer {
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new SessionRuleError('Invalid session');
  return Buffer.from(digest, 'hex');
}
export function rotateSession(session: Session, presentedDigest: string, nextDigest: string, expectedVersion: number, now: number, expiresAt: number): Session {
  const presented = digestBytes(presentedDigest);
  const stored = digestBytes(session.tokenDigest);
  const next = digestBytes(nextDigest);
  if (!isUsableSession(session, now) || expectedVersion !== session.version || !timingSafeEqual(stored, presented) || timingSafeEqual(stored, next) || !Number.isFinite(expiresAt) || expiresAt <= now) {
    throw new SessionRuleError('Invalid session');
  }
  return { ...session, tokenDigest: nextDigest, expiresAt, version: session.version + 1 };
}
export function revokeSession(session: Session, now: number): Session {
  if (!Number.isFinite(now)) throw new SessionRuleError('Invalid time');
  return session.revokedAt === null ? { ...session, revokedAt: now, version: session.version + 1 } : session;
}
