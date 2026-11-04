import { UserId } from '@shared/domain/value-objects/user-id';
import { AgencyIdentity } from './agency-identity';
import { AgencySite } from './agency-site';
import { CapabilityTransition } from './capability';
import { ServiceZone } from './service-zone';
import { AgencyId } from './value-objects/agency-id';
import { Description } from './value-objects/description';
import { TradeName } from './value-objects/trade-name';

export const AGENCY_STATUSES = ['draft', 'submitted'] as const;
export type AgencyStatus = typeof AGENCY_STATUSES[number];

export function isAgencyStatus(value: string): value is AgencyStatus {
  return AGENCY_STATUSES.some(status => status === value);
}

export interface AgencySnapshot {
  readonly id: AgencyId;
  readonly tradeName: TradeName;
  readonly description: Description | null;
  readonly identity: AgencyIdentity;
  readonly status: AgencyStatus;
  /** Moves with the identity and the profile only; zones, sites and capabilities have their own rules. */
  readonly version: number;
  readonly createdBy: UserId;
  readonly createdAt: Date;
  readonly zones: readonly ServiceZone[];
  readonly sites: readonly AgencySite[];
  readonly capabilityTransitions: readonly CapabilityTransition[];
}
