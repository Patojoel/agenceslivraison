import { AgencyPublicProfile } from '../agency-public-profile';
import { AgencyId } from '../value-objects/agency-id';

/**
 * `added`; `slug_taken` (another agency holds that address: try the next one); `already_has_profile` (this agency was
 * published meanwhile by a concurrent request).
 */
export type AddProfileOutcome = 'added' | 'slug_taken' | 'already_has_profile';

export interface AgencyPublicProfileRepository {
  /** Takes the row lock for the rest of the transaction: publications, withdrawals and rebuilds of one agency queue up. */
  lockByAgency(agencyId: AgencyId): Promise<AgencyPublicProfile | null>;
  /** Never throws on a conflict: a failed statement would abort the transaction of the command. */
  add(profile: AgencyPublicProfile): Promise<AddProfileOutcome>;
  save(profile: AgencyPublicProfile): Promise<void>;
}

export const AGENCY_PUBLIC_PROFILE_REPOSITORY = Symbol('AgencyPublicProfileRepository');
