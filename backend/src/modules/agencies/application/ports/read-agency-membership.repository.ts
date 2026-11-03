import { MyAgencyReadModel } from '../read-models/my-agency.read-model';

export interface ActiveMembershipsCriteria {
  readonly userId: string;
  /** Exclusive lower bound on `agencyId`, from the previous page. */
  readonly after: string | null;
  readonly limit: number;
}

export interface ReadAgencyMembershipRepository {
  /** The user's active memberships ordered by `agencyId`, at most `limit` rows. */
  listActiveForUser(criteria: ActiveMembershipsCriteria): Promise<readonly MyAgencyReadModel[]>;
}

export const READ_AGENCY_MEMBERSHIP_REPOSITORY = Symbol('ReadAgencyMembershipRepository');
