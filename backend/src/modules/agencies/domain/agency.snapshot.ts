import { UserId } from '@shared/domain/value-objects/user-id';
import { AgencyIdentity } from './agency-identity';
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
  readonly version: number;
  readonly createdBy: UserId;
  readonly createdAt: Date;
}
