import { AgencyStatus } from '../../domain/agency.snapshot';

export interface AgencyIdentityReadModel {
  readonly legalName: string | null;
  readonly headquartersCity: string | null;
  readonly headquartersAddress: string | null;
  readonly primaryPhone: string | null;
  readonly contactEmail: string | null;
  readonly rccm: string | null;
  readonly niu: string | null;
}

/** An agency as a member of its team sees it; `version` is what the next modification must quote. */
export interface AgencyReadModel {
  readonly id: string;
  readonly status: AgencyStatus;
  readonly tradeName: string;
  readonly description: string | null;
  readonly identity: AgencyIdentityReadModel;
  readonly version: number;
}
