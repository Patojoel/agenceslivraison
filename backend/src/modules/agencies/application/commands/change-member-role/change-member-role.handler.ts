import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { UserId } from '@shared/domain/value-objects/user-id';
import { AGENCY_TEAM_REPOSITORY, AgencyTeamRepository } from '../../../domain/ports/agency-team.repository';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { MembershipId } from '../../../domain/value-objects/membership-id';
import { ChangeMemberRoleCommand } from './change-member-role.command';

@Injectable()
export class ChangeMemberRoleHandler implements CommandHandler<ChangeMemberRoleCommand, { success: true }> {
  constructor(
    @Inject(AGENCY_TEAM_REPOSITORY) private readonly teams: AgencyTeamRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: ChangeMemberRoleCommand): Promise<{ success: true }> {
    const team = await this.teams.lockAndLoad(AgencyId.of(command.agencyId));
    team.changeRole(UserId.of(command.actorId), MembershipId.of(command.membershipId), command.role);
    await this.teams.save(team);
    await this.events.publish(team.pullEvents());
    return { success: true };
  }
}
