import { AgencyPublicView } from '../read-models/agency-public-view.read-model';

export interface ReadAgencyPublicViewRepository {
  /** `null` for an unknown agency. */
  publicViewOf(agencyId: string): Promise<AgencyPublicView | null>;
  /**
   * The same, after locking the agency row for the rest of the current transaction against every other writer of the
   * agency: the changes of `agencies` (exclusive lock) and the writes of the other modules (shared lock, such as a new
   * version of the rate card) wait for the caller, and the caller waits for them. What a publication needs, so that the
   * public directory is never written from a state that a concurrent write is about to change.
   */
  publicViewOfLockedForPublication(agencyId: string): Promise<AgencyPublicView | null>;
}

export const READ_AGENCY_PUBLIC_VIEW_REPOSITORY = Symbol('ReadAgencyPublicViewRepository');
