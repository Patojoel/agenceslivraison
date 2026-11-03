import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { TOKEN_SECRETS, TokenSecrets } from '@shared/application/ports/token-secrets.port';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { UUID_GENERATOR, UuidGenerator } from '@shared/domain/ports/uuid-generator.port';
import { Email } from '@shared/domain/value-objects/email';
import { OpaqueToken } from '@shared/domain/value-objects/opaque-token';
import { UserId } from '@shared/domain/value-objects/user-id';
import { Invitation } from '../../../domain/invitation';
import { AGENCY_TEAM_REPOSITORY, AgencyTeamRepository } from '../../../domain/ports/agency-team.repository';
import { INVITATION_REPOSITORY, InvitationRepository } from '../../../domain/ports/invitation.repository';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { InvitationId } from '../../../domain/value-objects/invitation-id';
import { IssueInvitationCommand } from './issue-invitation.command';
import { IssueInvitationResponse } from './issue-invitation.response';

@Injectable()
export class IssueInvitationHandler implements CommandHandler<IssueInvitationCommand, IssueInvitationResponse> {
  constructor(
    @Inject(AGENCY_TEAM_REPOSITORY) private readonly teams: AgencyTeamRepository,
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(TOKEN_SECRETS) private readonly secrets: TokenSecrets,
    @Inject(UUID_GENERATOR) private readonly uuid: UuidGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: IssueInvitationCommand): Promise<IssueInvitationResponse> {
    const actorId = UserId.of(command.actorId);
    const team = await this.teams.lockAndLoad(AgencyId.of(command.agencyId));
    team.authorizeInvitation(actorId, command.role);
    const secret = this.secrets.generate();
    const invitation = Invitation.issue({
      id: InvitationId.of(this.uuid.generate()), agencyId: team.agencyId, email: Email.of(command.email),
      role: command.role, tokenDigest: this.secrets.digest(secret), createdBy: actorId,
    }, this.clock.now());
    await this.invitations.add(invitation);
    await this.events.publish(invitation.pullEvents());
    return { token: OpaqueToken.compose(invitation.id.value, secret).toString(), expiresAt: invitation.expiresAt.toISOString() };
  }
}
