import type { AgencyRole } from '@modules/agencies/application/queries/agency-access/agency-access.contract';

/** The roles of a member of an agency, as `agencies` defines them. */
export type MemberRole = AgencyRole;

/** A zone of the agency, active or retired, with the label a person reads. */
export interface DeliveryZone {
  readonly id: string;
  readonly city: string;
  readonly district: string | null;
  readonly active: boolean;
}

export interface DeliveryAgencyState {
  readonly deliveryActive: boolean;
  readonly zones: readonly DeliveryZone[];
}

/** What pricing needs to know of an agency, behind a port: the tables of `agencies` are never read from here. */
export interface AgencyAccess {
  /** The role of an active member; `null` for a former member, a stranger and an unknown agency alike. */
  activeRoleOf(agencyId: string, userId: string): Promise<MemberRole | null>;
  deliveryState(agencyId: string): Promise<DeliveryAgencyState>;
  /**
   * The same, with a shared lock on the agency for the rest of the transaction: a zone cannot be retired between the
   * check and the write. Only to be called once the caller's role was checked.
   */
  deliveryStateLockedShared(agencyId: string): Promise<DeliveryAgencyState>;
}

export const AGENCY_ACCESS = Symbol('AgencyAccess');
