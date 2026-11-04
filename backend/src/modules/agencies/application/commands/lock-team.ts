import { UserId } from '@shared/domain/value-objects/user-id';
import { AgencyTeam } from '../../domain/agency-team';
import { AgencyTeamRepository } from '../../domain/ports/agency-team.repository';
import { AgencyId } from '../../domain/value-objects/agency-id';

/**
 * Takes the lock of the agency only for someone the rules let through: the team is first read without any lock and
 * `authorize` (by default, being an active member) is applied to it, so a stranger, a former member or a role that
 * may not act cannot make anyone wait on the agency row. The caller decides again on the team returned under the lock,
 * which is the one that counts if the team changed in between.
 */
export async function lockTeamForActor(
  teams: AgencyTeamRepository,
  agencyId: AgencyId,
  actorId: UserId,
  authorize: (team: AgencyTeam, actorId: UserId) => void = (team, actor) => team.assertActiveMember(actor),
): Promise<AgencyTeam> {
  authorize(await teams.load(agencyId), actorId);
  return teams.lockAndLoad(agencyId);
}
