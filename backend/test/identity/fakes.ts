import { ServiceUnavailableError } from '../../src/shared/application/service-unavailable.error';
import { Email } from '../../src/shared/domain/vo/email';
import { UserId } from '../../src/shared/domain/vo/user-id';
import { AccessTokenClaims, AccessTokens, AccessTokenSigner } from '../../src/modules/identity/application/ports/access-tokens';
import { PasswordHasher } from '../../src/modules/identity/application/ports/password-hasher';
import { EmailAlreadyRegistered } from '../../src/modules/identity/domain/exceptions/identity.exceptions';
import { Session, SessionState } from '../../src/modules/identity/domain/model/session';
import { User, UserState } from '../../src/modules/identity/domain/model/user';
import { SessionRepository } from '../../src/modules/identity/domain/repositories/session.repository';
import { UserRepository } from '../../src/modules/identity/domain/repositories/user.repository';
import { NewPassword } from '../../src/modules/identity/domain/vo/new-password';
import { SessionId } from '../../src/modules/identity/domain/vo/session-id';

export class InMemoryUserRepository implements UserRepository {
  private readonly rows = new Map<string, UserState>();

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
  private readonly rows = new Map<string, SessionState>();

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

  stored(id: string): SessionState | undefined {
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
