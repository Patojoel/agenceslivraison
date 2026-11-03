import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { TOKEN_SECRETS, TokenSecrets } from '@shared/application/ports/token-secrets.port';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { OpaqueToken } from '@shared/domain/value-objects/opaque-token';
import { InvalidSession } from '../../../domain/exceptions/identity.exceptions';
import { SESSION_REPOSITORY, SessionRepository } from '../../../domain/ports/session.repository';
import { SessionId } from '../../../domain/value-objects/session-id';
import { LogoutCommand } from './logout.command';

@Injectable()
export class LogoutHandler implements CommandHandler<LogoutCommand, { success: true }> {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(TOKEN_SECRETS) private readonly secrets: TokenSecrets,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: LogoutCommand): Promise<{ success: true }> {
    const token = OpaqueToken.parse(command.refreshToken);
    const session = await this.sessions.findForUpdate(SessionId.of(token.id));
    if (!session) throw new InvalidSession();
    session.revoke(this.secrets.digest(token.secret), this.clock.now());
    await this.sessions.save(session);
    await this.events.publish(session.pullEvents());
    return { success: true };
  }
}
