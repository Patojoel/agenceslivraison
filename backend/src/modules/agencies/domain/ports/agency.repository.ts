import { Agency } from '../agency';
import { AgencyId } from '../value-objects/agency-id';

export const AGENCY_REPOSITORY = Symbol('AgencyRepository');

export interface AgencyRepository {
  add(agency: Agency): Promise<void>;
  /** To be called after `AgencyTeamRepository.lockAndLoad`, which holds the agency row until the transaction ends. */
  findById(id: AgencyId): Promise<Agency | null>;
  /** Writes a modified agency over the version it was loaded at; a concurrent change makes it throw `StaleAgencyVersion`. */
  save(agency: Agency): Promise<void>;
}
