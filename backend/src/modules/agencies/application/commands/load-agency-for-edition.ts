import { UserId } from '@shared/domain/value-objects/user-id';
import { Agency } from '../../domain/agency';
import { AgencyTeam } from '../../domain/agency-team';
import { AgencyNotFound } from '../../domain/exceptions/agency.exceptions';
import { AgencyRepository } from '../../domain/ports/agency.repository';
import { AgencyTeamRepository } from '../../domain/ports/agency-team.repository';
import { AgencyId } from '../../domain/value-objects/agency-id';
import { lockTeamForActor } from './lock-team';

/**
 * The protocol of every configuration write: the team decides who may act (an outsider sees "not found", an agent
 * "forbidden") first without any lock, so that nobody refused can hold up the agency, then again under the agency lock;
 * only then is the agency loaded and written.
 * `authorize` is the rule of the action; by default, the edition of the configuration.
 */
export async function loadAgencyForEdition(
  teams: AgencyTeamRepository,
  agencies: AgencyRepository,
  agencyId: string,
  actor: string,
  authorize: (team: AgencyTeam, actorId: UserId) => void = (team, actorId) => team.authorizeAgencyEdition(actorId),
): Promise<{ readonly agency: Agency; readonly actorId: UserId }> {
  const id = AgencyId.of(agencyId);
  const actorId = UserId.of(actor);
  const team = await lockTeamForActor(teams, id, actorId, authorize);
  authorize(team, actorId);
  const agency = await agencies.findById(id);
  if (!agency) throw new AgencyNotFound();
  return { agency, actorId };
}
