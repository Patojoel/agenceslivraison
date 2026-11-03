import { CommandHandler } from '../../../../../shared/application/command-handler';
import { Clock } from '../../../../../shared/application/ports/clock';
import { DomainEventPublisher } from '../../../../../shared/application/ports/domain-events';
import { IdGenerator } from '../../../../../shared/application/ports/id-generator';
import { TokenSecrets } from '../../../../../shared/application/ports/token-secrets';
import { Email } from '../../../../../shared/domain/vo/email';
import { OpaqueToken } from '../../../../../shared/domain/vo/opaque-token';
import { UserId } from '../../../../../shared/domain/vo/user-id';
import { Invitation } from '../../../domain/model/invitation';
import { AgencyTeamRepository } from '../../../domain/repositories/agency-team.repository';
import { InvitationRepository } from '../../../domain/repositories/invitation.repository';
import { AgencyId } from '../../../domain/vo/agency-id';
import { InvitationId } from '../../../domain/vo/invitation-id';
import { IssueInvitationCommand } from './issue-invitation.command';
import { IssueInvitationResponse } from './issue-invitation.response';

export class IssueInvitationHandler implements CommandHandler<IssueInvitationCommand, IssueInvitationResponse> {
  constructor(
    private readonly teams: AgencyTeamRepository,
    private readonly invitations: InvitationRepository,
    private readonly secrets: TokenSecrets,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: IssueInvitationCommand): Promise<IssueInvitationResponse> {
    const actorId = UserId.of(command.actorId);
    const team = await this.teams.lockAndLoad(AgencyId.of(command.agencyId));
    team.authorizeInvitation(actorId, command.role);
    const secret = this.secrets.generate();
    const invitation = Invitation.issue({
      id: InvitationId.of(this.ids.generate()), agencyId: team.agencyId, email: Email.of(command.email),
      role: command.role, tokenDigest: this.secrets.digest(secret), createdBy: actorId,
    }, this.clock.now());
    await this.invitations.add(invitation);
    await this.events.publish(invitation.pullEvents());
    return { token: OpaqueToken.compose(invitation.id.value, secret).toString(), expiresAt: invitation.expiresAt.toISOString() };
  }
}
