import { AgencyTeam } from '../model/agency-team';
import { AgencyId } from '../vo/agency-id';

export const AGENCY_TEAM_REPOSITORY = Symbol('AgencyTeamRepository');

export interface AgencyTeamRepository {
  /**
   * Holds the agency until the transaction ends: every team change takes this lock, which keeps the
   * last-owner rule true under concurrency. An unknown agency yields an empty team.
   */
  lockAndLoad(agencyId: AgencyId): Promise<AgencyTeam>;
  save(team: AgencyTeam): Promise<void>;
}
