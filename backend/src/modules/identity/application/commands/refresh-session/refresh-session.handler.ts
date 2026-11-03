import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { TOKEN_SECRETS, TokenSecrets } from '@shared/application/ports/token-secrets.port';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { OpaqueToken } from '@shared/domain/value-objects/opaque-token';
import { InvalidSession } from '../../../domain/exceptions/identity.exceptions';
import { SESSION_REPOSITORY, SessionRepository } from '../../../domain/ports/session.repository';
import { SessionId } from '../../../domain/value-objects/session-id';
import { ACCESS_TOKENS, AccessTokens } from '../../ports/access-tokens.port';
import { SessionTokensResponse } from '../session-tokens.response';
import { RefreshSessionCommand } from './refresh-session.command';

@Injectable()
export class RefreshSessionHandler implements CommandHandler<RefreshSessionCommand, SessionTokensResponse> {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(ACCESS_TOKENS) private readonly accessTokens: AccessTokens,
    @Inject(TOKEN_SECRETS) private readonly secrets: TokenSecrets,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
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
