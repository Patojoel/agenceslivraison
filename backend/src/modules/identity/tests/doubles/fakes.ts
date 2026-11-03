import { ServiceUnavailableError } from '@shared/application/errors/service-unavailable.error';
import { Email } from '@shared/domain/value-objects/email';
import { UserId } from '@shared/domain/value-objects/user-id';
import { AccessTokenClaims, AccessTokens, AccessTokenSigner } from '../../application/ports/access-tokens.port';
import { PasswordHasher } from '../../application/ports/password-hasher.port';
import { EmailAlreadyRegistered } from '../../domain/exceptions/identity.exceptions';
import { Session } from '../../domain/session';
import { SessionSnapshot } from '../../domain/session.snapshot';
import { User } from '../../domain/user';
import { UserSnapshot } from '../../domain/user.snapshot';
import { SessionRepository } from '../../domain/ports/session.repository';
import { UserRepository } from '../../domain/ports/user.repository';
import { NewPassword } from '../../domain/value-objects/new-password';
import { SessionId } from '../../domain/value-objects/session-id';

export class InMemoryUserRepository implements UserRepository {
  private readonly rows = new Map<string, UserSnapshot>();

  async add(user: User): Promise<void> {
    if (this.rows.has(user.email.value)) throw new EmailAlreadyRegistered();
    this.rows.set(user.email.value, { id: user.id, email: user.email, passwordHash: user.passwordHash, accountType: user.accountType });
  }

  async findByEmail(email: Email): Promise<User | null> {
    const state = this.rows.get(email.value);
    return state ? User.reconstitute(state) : null;
  }

  count(): number {
    return this.rows.size;
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly rows = new Map<string, SessionSnapshot>();

  async add(session: Session): Promise<void> {
    this.rows.set(session.id.value, session.snapshot());
  }

  async findForUpdate(id: SessionId): Promise<Session | null> {
    const state = this.rows.get(id.value);
    return state ? Session.reconstitute(state) : null;
  }

  async save(session: Session): Promise<void> {
    this.rows.set(session.id.value, session.snapshot());
  }

  stored(id: string): SessionSnapshot | undefined {
    return this.rows.get(id);
  }

  count(): number {
    return this.rows.size;
  }
}

export class FakePasswordHasher implements PasswordHasher {
  readonly verifiedHashes: (string | null)[] = [];

  async hash(password: NewPassword): Promise<string> {
    return `hashed:${password.value}`;
  }

  async verify(hash: string | null, candidate: string): Promise<boolean> {
    this.verifiedHashes.push(hash);
    return hash === `hashed:${candidate}`;
  }
}

export class FakeAccessTokens implements AccessTokens {
  available = true;

  signer(): AccessTokenSigner {
    if (!this.available) throw new ServiceUnavailableError('no key');
    return { sign: (userId: UserId, sessionId: SessionId) => ({ token: `access:${userId.value}:${sessionId.value}`, expiresIn: 900 }) };
  }

  verify(token: string): AccessTokenClaims | null {
    if (!this.available) throw new ServiceUnavailableError('no key');
    const [prefix, userId, sessionId] = token.split(':');
    return prefix === 'access' && userId && sessionId ? { userId, sessionId } : null;
  }
}
