import { AgencyRole } from '../../../domain/agency-role';
import { AgencyStatus } from '../../../domain/agency.snapshot';

export interface CreateAgencyResponse {
  readonly agencyId: string;
  readonly tradeName: string;
  readonly status: AgencyStatus;
  readonly role: AgencyRole;
}
