import { AggregateRoot } from '@shared/domain/aggregate-root';
import { TokenDigest } from '@shared/domain/value-objects/token-digest';
import { UserId } from '@shared/domain/value-objects/user-id';
import { IdentityEvent } from './events/identity-events';
import { InvalidSession } from './exceptions/identity.exceptions';
import { SessionSnapshot } from './session.snapshot';
import { SessionId } from './value-objects/session-id';

export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export class Session extends AggregateRoot<IdentityEvent> {
  private constructor(private state: SessionSnapshot) {
    super();
  }

  static open(id: SessionId, userId: UserId, tokenDigest: TokenDigest, now: Date): Session {
    const session = new Session({ id, userId, tokenDigest, expiresAt: expiryFrom(now), revokedAt: null, version: 1 });
    session.record({ type: 'SessionOpened', userId: userId.value, sessionId: id.value });
    return session;
  }

  static reconstitute(state: SessionSnapshot): Session {
    return new Session(state);
  }

  get id(): SessionId { return this.state.id; }
  get userId(): UserId { return this.state.userId; }

  snapshot(): SessionSnapshot {
    return this.state;
  }

  isUsable(now: Date): boolean {
    return this.state.revokedAt === null && now < this.state.expiresAt;
  }

  rotate(presented: TokenDigest, next: TokenDigest, now: Date): void {
    if (!this.isUsable(now) || !this.state.tokenDigest.matches(presented) || this.state.tokenDigest.matches(next)) throw new InvalidSession();
    this.state = { ...this.state, tokenDigest: next, expiresAt: expiryFrom(now), version: this.state.version + 1 };
    this.record({ type: 'SessionRefreshed', userId: this.state.userId.value, sessionId: this.state.id.value });
  }

  /** Logout stays possible after expiry, so a client can always end a session it still holds. */
  revoke(presented: TokenDigest, now: Date): void {
    if (this.state.revokedAt !== null || !this.state.tokenDigest.matches(presented)) throw new InvalidSession();
    this.state = { ...this.state, revokedAt: now, version: this.state.version + 1 };
    this.record({ type: 'SessionRevoked', userId: this.state.userId.value, sessionId: this.state.id.value });
  }
}

function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + SESSION_LIFETIME_MS);
}
