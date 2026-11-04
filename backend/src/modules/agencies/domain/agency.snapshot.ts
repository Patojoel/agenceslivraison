import { UserId } from '@shared/domain/value-objects/user-id';
import { AgencyId } from './value-objects/agency-id';
import { TradeName } from './value-objects/trade-name';

export const AGENCY_STATUSES = ['draft', 'submitted'] as const;
export type AgencyStatus = typeof AGENCY_STATUSES[number];

export interface AgencySnapshot {
  readonly id: AgencyId;
  readonly tradeName: TradeName;
  readonly status: AgencyStatus;
  readonly version: number;
  readonly createdBy: UserId;
  readonly createdAt: Date;
}
