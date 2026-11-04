import { AgencyTeam } from '../agency-team';
import { AgencyId } from '../value-objects/agency-id';

export const AGENCY_TEAM_REPOSITORY = Symbol('AgencyTeamRepository');

export interface AgencyTeamRepository {
  /** Reads the team without holding anything: only for the check that must precede `lockAndLoad`. An unknown agency yields an empty team. */
  load(agencyId: AgencyId): Promise<AgencyTeam>;
  /**
   * Holds the agency until the transaction ends: every team change takes this lock, which keeps the
   * last-owner rule true under concurrency. An unknown agency yields an empty team.
   */
  lockAndLoad(agencyId: AgencyId): Promise<AgencyTeam>;
  save(team: AgencyTeam): Promise<void>;
}
