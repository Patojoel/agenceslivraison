import { CommandHandler } from '../../../../../shared/application/command-handler';
import { DomainEventPublisher } from '../../../../../shared/application/ports/domain-events';
import { UserId } from '../../../../../shared/domain/vo/user-id';
import { AgencyTeamRepository } from '../../../domain/repositories/agency-team.repository';
import { AgencyId } from '../../../domain/vo/agency-id';
import { MembershipId } from '../../../domain/vo/membership-id';
import { RevokeMembershipCommand } from './revoke-membership.command';

export class RevokeMembershipHandler implements CommandHandler<RevokeMembershipCommand, { success: true }> {
  constructor(private readonly teams: AgencyTeamRepository, private readonly events: DomainEventPublisher) {}

  async handle(command: RevokeMembershipCommand): Promise<{ success: true }> {
    const team = await this.teams.lockAndLoad(AgencyId.of(command.agencyId));
    team.revoke(UserId.of(command.actorId), MembershipId.of(command.membershipId));
    await this.teams.save(team);
    await this.events.publish(team.pullEvents());
    return { success: true };
  }
}
