import { CommandHandler } from '../../../../../shared/application/command-handler';
import { Clock } from '../../../../../shared/application/ports/clock';
import { DomainEventPublisher } from '../../../../../shared/application/ports/domain-events';
import { IdGenerator } from '../../../../../shared/application/ports/id-generator';
import { TokenSecrets } from '../../../../../shared/application/ports/token-secrets';
import { Email } from '../../../../../shared/domain/vo/email';
import { OpaqueToken } from '../../../../../shared/domain/vo/opaque-token';
import { UserId } from '../../../../../shared/domain/vo/user-id';
import { InvitationNotFound } from '../../../domain/exceptions/agency.exceptions';
import { AgencyTeamRepository } from '../../../domain/repositories/agency-team.repository';
import { InvitationRepository } from '../../../domain/repositories/invitation.repository';
import { InvitationId } from '../../../domain/vo/invitation-id';
import { MembershipId } from '../../../domain/vo/membership-id';
import { AcceptInvitationCommand } from './accept-invitation.command';
import { AcceptInvitationResponse } from './accept-invitation.response';

/**
 * Deliberately changes two aggregates in one transaction (see docs/domains.md): the caller must learn
 * synchronously that they are already a member, and the invitation must then stay unused.
 */
export class AcceptInvitationHandler implements CommandHandler<AcceptInvitationCommand, AcceptInvitationResponse> {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly teams: AgencyTeamRepository,
    private readonly secrets: TokenSecrets,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: AcceptInvitationCommand): Promise<AcceptInvitationResponse> {
    const token = OpaqueToken.parse(command.token);
    const invitation = await this.invitations.findForUpdate(InvitationId.of(token.id));
    if (!invitation) throw new InvitationNotFound();
    const userId = UserId.of(command.userId);
    invitation.accept(this.secrets.digest(token.secret), { userId, email: command.email === null ? null : Email.of(command.email) }, this.clock.now());
    const team = await this.teams.lockAndLoad(invitation.agencyId);
    team.admit(MembershipId.of(this.ids.generate()), userId, invitation.role);
    await this.teams.save(team);
    await this.invitations.save(invitation);
    await this.events.publish(invitation.pullEvents());
    return { agencyId: invitation.agencyId.value, role: invitation.role };
  }
}
