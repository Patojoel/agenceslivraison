import { CommandHandler } from '../../../../../shared/application/command-handler';
import { Clock } from '../../../../../shared/application/ports/clock';
import { DomainEventPublisher } from '../../../../../shared/application/ports/domain-events';
import { TokenSecrets } from '../../../../../shared/application/ports/token-secrets';
import { OpaqueToken } from '../../../../../shared/domain/vo/opaque-token';
import { InvalidSession } from '../../../domain/exceptions/identity.exceptions';
import { SessionRepository } from '../../../domain/repositories/session.repository';
import { SessionId } from '../../../domain/vo/session-id';
import { LogoutCommand } from './logout.command';

export class LogoutHandler implements CommandHandler<LogoutCommand, { success: true }> {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly secrets: TokenSecrets,
    private readonly clock: Clock,
    private readonly events: DomainEventPublisher,
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
