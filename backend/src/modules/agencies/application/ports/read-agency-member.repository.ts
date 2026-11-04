import { AgencyMemberReadModel } from '../read-models/agency-member.read-model';

export const READ_AGENCY_MEMBER_REPOSITORY = Symbol('ReadAgencyMemberRepository');

export interface ActiveMembersCriteria {
  readonly agencyId: string;
  /** The person who reads: nothing is returned unless they are an active member of the agency. */
  readonly userId: string;
  /** Exclusive lower bound on the membership identifier, from the previous page. */
  readonly after: string | null;
  readonly limit: number;
}

export interface ReadAgencyMemberRepository {
  /** The active memberships of the agency ordered by identifier, at most `limit` rows; none when the reader is not an active member. */
  listActiveForMember(criteria: ActiveMembersCriteria): Promise<readonly AgencyMemberReadModel[]>;
  /** Tells an empty page from a reader without access. */
  isActiveMember(agencyId: string, userId: string): Promise<boolean>;
}
