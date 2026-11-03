import { CommandHandler } from '../../../../../shared/application/command-handler';
import { DomainEventPublisher } from '../../../../../shared/application/ports/domain-events';
import { UserId } from '../../../../../shared/domain/vo/user-id';
import { AgencyTeamRepository } from '../../../domain/repositories/agency-team.repository';
import { AgencyId } from '../../../domain/vo/agency-id';
import { MembershipId } from '../../../domain/vo/membership-id';
import { ChangeMemberRoleCommand } from './change-member-role.command';

export class ChangeMemberRoleHandler implements CommandHandler<ChangeMemberRoleCommand, { success: true }> {
  constructor(private readonly teams: AgencyTeamRepository, private readonly events: DomainEventPublisher) {}

  async handle(command: ChangeMemberRoleCommand): Promise<{ success: true }> {
    const team = await this.teams.lockAndLoad(AgencyId.of(command.agencyId));
    team.changeRole(UserId.of(command.actorId), MembershipId.of(command.membershipId), command.role);
    await this.teams.save(team);
    await this.events.publish(team.pullEvents());
    return { success: true };
  }
}
