import { AgencyPublicView } from '../read-models/agency-public-view.read-model';

export interface ReadAgencyPublicViewRepository {
  /** `null` for an unknown agency. */
  publicViewOf(agencyId: string): Promise<AgencyPublicView | null>;
  /**
   * The same, after taking a shared lock on the agency row for the rest of the current transaction: it waits for a change
   * that locks the row exclusively (a zone, a site or a capability) and makes the next one wait for the caller.
   */
  publicViewOfLockedShared(agencyId: string): Promise<AgencyPublicView | null>;
}

export const READ_AGENCY_PUBLIC_VIEW_REPOSITORY = Symbol('ReadAgencyPublicViewRepository');
