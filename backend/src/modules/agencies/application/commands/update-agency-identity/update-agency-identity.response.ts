import { AgencyIdentityReadModel } from '../../read-models/agency.read-model';

export interface UpdateAgencyIdentityResponse {
  readonly version: number;
  readonly identity: AgencyIdentityReadModel;
}
