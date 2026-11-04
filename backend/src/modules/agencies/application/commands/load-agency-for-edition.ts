import { UserId } from '@shared/domain/value-objects/user-id';
import { Agency } from '../../domain/agency';
import { AgencyNotFound } from '../../domain/exceptions/agency.exceptions';
import { AgencyRepository } from '../../domain/ports/agency.repository';
import { AgencyTeamRepository } from '../../domain/ports/agency-team.repository';
import { AgencyId } from '../../domain/value-objects/agency-id';

/**
 * The protocol of every configuration write: the team under the agency lock decides who may act
 * (an outsider sees "not found", an agent "forbidden"), then only the agency is loaded and written.
 */
export async function loadAgencyForEdition(teams: AgencyTeamRepository, agencies: AgencyRepository, agencyId: string, actor: string): Promise<{ readonly agency: Agency; readonly actorId: UserId }> {
  const id = AgencyId.of(agencyId);
  const actorId = UserId.of(actor);
  const team = await teams.lockAndLoad(id);
  team.authorizeAgencyEdition(actorId);
  const agency = await agencies.findById(id);
  if (!agency) throw new AgencyNotFound();
  return { agency, actorId };
}
