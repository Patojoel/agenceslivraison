import { CommandHandler } from '../../../../../shared/application/command-handler';
import { Clock } from '../../../../../shared/application/ports/clock';
import { DomainEventPublisher } from '../../../../../shared/application/ports/domain-events';
import { TokenSecrets } from '../../../../../shared/application/ports/token-secrets';
import { OpaqueToken } from '../../../../../shared/domain/vo/opaque-token';
import { InvalidSession } from '../../../domain/exceptions/identity.exceptions';
import { SessionRepository } from '../../../domain/repositories/session.repository';
import { SessionId } from '../../../domain/vo/session-id';
import { AccessTokens } from '../../ports/access-tokens';
import { SessionTokensResponse } from '../session-tokens.response';
import { RefreshSessionCommand } from './refresh-session.command';

export class RefreshSessionHandler implements CommandHandler<RefreshSessionCommand, SessionTokensResponse> {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly accessTokens: AccessTokens,
    private readonly secrets: TokenSecrets,
    private readonly clock: Clock,
    private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: RefreshSessionCommand): Promise<SessionTokensResponse> {
    const signer = this.accessTokens.signer();
    const token = OpaqueToken.parse(command.refreshToken);
    const session = await this.sessions.findForUpdate(SessionId.of(token.id));
    if (!session) throw new InvalidSession();
    const next = this.secrets.generate();
    session.rotate(this.secrets.digest(token.secret), this.secrets.digest(next), this.clock.now());
    const access = signer.sign(session.userId, session.id);
    await this.sessions.save(session);
    await this.events.publish(session.pullEvents());
    return { accessToken: access.token, refreshToken: OpaqueToken.compose(session.id.value, next).toString(), expiresIn: access.expiresIn };
  }
}
