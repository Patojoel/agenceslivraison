import { CommandHandler } from '../../../../../shared/application/command-handler';
import { Clock } from '../../../../../shared/application/ports/clock';
import { DomainEventPublisher } from '../../../../../shared/application/ports/domain-events';
import { IdGenerator } from '../../../../../shared/application/ports/id-generator';
import { TokenSecrets } from '../../../../../shared/application/ports/token-secrets';
import { Email } from '../../../../../shared/domain/vo/email';
import { OpaqueToken } from '../../../../../shared/domain/vo/opaque-token';
import { InvalidCredentials } from '../../../domain/exceptions/identity.exceptions';
import { Session } from '../../../domain/model/session';
import { SessionRepository } from '../../../domain/repositories/session.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { SessionId } from '../../../domain/vo/session-id';
import { AccessTokens } from '../../ports/access-tokens';
import { PasswordHasher } from '../../ports/password-hasher';
import { SessionTokensResponse } from '../session-tokens.response';
import { LoginCommand } from './login.command';

export class LoginHandler implements CommandHandler<LoginCommand, SessionTokensResponse> {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly hasher: PasswordHasher,
    private readonly accessTokens: AccessTokens,
    private readonly secrets: TokenSecrets,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: LoginCommand): Promise<SessionTokensResponse> {
    const signer = this.accessTokens.signer();
    const user = await this.users.findByEmail(Email.of(command.email));
    const valid = await this.hasher.verify(user?.passwordHash ?? null, command.password);
    if (!user || !valid) throw new InvalidCredentials();
    const secret = this.secrets.generate();
    const session = Session.open(SessionId.of(this.ids.generate()), user.id, this.secrets.digest(secret), this.clock.now());
    const access = signer.sign(user.id, session.id);
    await this.sessions.add(session);
    await this.events.publish(session.pullEvents());
    return { accessToken: access.token, refreshToken: OpaqueToken.compose(session.id.value, secret).toString(), expiresIn: access.expiresIn };
  }
}
