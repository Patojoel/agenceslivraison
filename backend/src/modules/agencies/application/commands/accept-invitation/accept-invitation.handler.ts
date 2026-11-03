import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { TOKEN_SECRETS, TokenSecrets } from '@shared/application/ports/token-secrets.port';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { UUID_GENERATOR, UuidGenerator } from '@shared/domain/ports/uuid-generator.port';
import { Email } from '@shared/domain/value-objects/email';
import { OpaqueToken } from '@shared/domain/value-objects/opaque-token';
import { UserId } from '@shared/domain/value-objects/user-id';
import { InvitationNotFound } from '../../../domain/exceptions/agency.exceptions';
import { AGENCY_TEAM_REPOSITORY, AgencyTeamRepository } from '../../../domain/ports/agency-team.repository';
import { INVITATION_REPOSITORY, InvitationRepository } from '../../../domain/ports/invitation.repository';
import { InvitationId } from '../../../domain/value-objects/invitation-id';
import { MembershipId } from '../../../domain/value-objects/membership-id';
import { AcceptInvitationCommand } from './accept-invitation.command';
import { AcceptInvitationResponse } from './accept-invitation.response';

/**
 * Deliberately changes two aggregates in one transaction (see docs/domains.md): the caller must learn
 * synchronously that they are already a member, and the invitation must then stay unused.
 */
@Injectable()
export class AcceptInvitationHandler implements CommandHandler<AcceptInvitationCommand, AcceptInvitationResponse> {
  constructor(
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(AGENCY_TEAM_REPOSITORY) private readonly teams: AgencyTeamRepository,
    @Inject(TOKEN_SECRETS) private readonly secrets: TokenSecrets,
    @Inject(UUID_GENERATOR) private readonly uuid: UuidGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: AcceptInvitationCommand): Promise<AcceptInvitationResponse> {
    const token = OpaqueToken.parse(command.token);
    const invitation = await this.invitations.findForUpdate(InvitationId.of(token.id));
    if (!invitation) throw new InvitationNotFound();
    const userId = UserId.of(command.userId);
    invitation.accept(this.secrets.digest(token.secret), { userId, email: command.email === null ? null : Email.of(command.email) }, this.clock.now());
    const team = await this.teams.lockAndLoad(invitation.agencyId);
    team.admit(MembershipId.of(this.uuid.generate()), userId, invitation.role);
    await this.teams.save(team);
    await this.invitations.save(invitation);
    await this.events.publish(invitation.pullEvents());
    return { agencyId: invitation.agencyId.value, role: invitation.role };
  }
}
