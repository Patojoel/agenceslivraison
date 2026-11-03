import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { TOKEN_SECRETS, TokenSecrets } from '@shared/application/ports/token-secrets.port';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { UUID_GENERATOR, UuidGenerator } from '@shared/domain/ports/uuid-generator.port';
import { Email } from '@shared/domain/value-objects/email';
import { OpaqueToken } from '@shared/domain/value-objects/opaque-token';
import { InvalidCredentials } from '../../../domain/exceptions/identity.exceptions';
import { SESSION_REPOSITORY, SessionRepository } from '../../../domain/ports/session.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/ports/user.repository';
import { Session } from '../../../domain/session';
import { SessionId } from '../../../domain/value-objects/session-id';
import { ACCESS_TOKENS, AccessTokens } from '../../ports/access-tokens.port';
import { PASSWORD_HASHER, PasswordHasher } from '../../ports/password-hasher.port';
import { SessionTokensResponse } from '../session-tokens.response';
import { LoginCommand } from './login.command';

@Injectable()
export class LoginHandler implements CommandHandler<LoginCommand, SessionTokensResponse> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(ACCESS_TOKENS) private readonly accessTokens: AccessTokens,
    @Inject(TOKEN_SECRETS) private readonly secrets: TokenSecrets,
    @Inject(UUID_GENERATOR) private readonly uuid: UuidGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: LoginCommand): Promise<SessionTokensResponse> {
    const signer = this.accessTokens.signer();
    const user = await this.users.findByEmail(Email.of(command.email));
    const valid = await this.hasher.verify(user?.passwordHash ?? null, command.password);
    if (!user || !valid) throw new InvalidCredentials();
    const secret = this.secrets.generate();
    const session = Session.open(SessionId.of(this.uuid.generate()), user.id, this.secrets.digest(secret), this.clock.now());
    const access = signer.sign(user.id, session.id);
    await this.sessions.add(session);
    await this.events.publish(session.pullEvents());
    return { accessToken: access.token, refreshToken: OpaqueToken.compose(session.id.value, secret).toString(), expiresIn: access.expiresIn };
  }
}
