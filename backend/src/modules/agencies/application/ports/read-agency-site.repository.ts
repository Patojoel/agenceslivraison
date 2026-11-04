import { AgencySiteReadModel } from '../read-models/agency-site.read-model';

export interface ListAgencySitesCriteria {
  readonly agencyId: string;
  readonly userId: string;
  /** Identifier of the last site of the previous page. */
  readonly after: string | null;
  readonly limit: number;
}

export interface ReadAgencySiteRepository {
  /**
   * Active sites first, then deactivated ones, each by name and identifier; at most `limit` rows.
   * `null` when the agency does not exist or the user has no active membership in it.
   */
  listForMember(criteria: ListAgencySitesCriteria): Promise<readonly AgencySiteReadModel[] | null>;
}

export const READ_AGENCY_SITE_REPOSITORY = Symbol('ReadAgencySiteRepository');
