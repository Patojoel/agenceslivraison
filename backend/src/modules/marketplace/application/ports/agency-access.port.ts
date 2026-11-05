import type { AgencyRole } from '@modules/agencies/application/queries/agency-access/agency-access.contract';
import { AgencyPublicView } from '../../domain/agency-public-view';

/** The roles of a member of an agency, as `agencies` defines them. */
export type MemberRole = AgencyRole;

/** What marketplace needs to know of an agency, behind a port: the tables of `agencies` are never read from here. */
export interface AgencyAccess {
  /** The role of an active member; `null` for a former member, a stranger and an unknown agency alike. */
  activeRoleOf(agencyId: string, userId: string): Promise<MemberRole | null>;
  /** `null` for an unknown agency. */
  publicViewOf(agencyId: string): Promise<AgencyPublicView | null>;
  /**
   * The same, after a shared lock on the agency for the rest of the transaction: a capability cannot be suspended between
   * the check and the write. Only to be called once the caller's role was checked.
   */
  publicViewOfLockedShared(agencyId: string): Promise<AgencyPublicView | null>;
}

export const AGENCY_ACCESS = Symbol('AgencyAccess');
