import { MemberAgencyReadModel } from '../read-models/agency.read-model';

export const READ_AGENCY_REPOSITORY = Symbol('ReadAgencyRepository');

export interface ReadAgencyRepository {
  /** The agency and the reader's role; `null` when the agency does not exist or the user has no active membership in it. */
  findForMember(agencyId: string, userId: string): Promise<MemberAgencyReadModel | null>;
}
