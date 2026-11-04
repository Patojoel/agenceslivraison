import { AgencyOnboardingReadModel } from '../read-models/agency-onboarding.read-model';

export const READ_AGENCY_ONBOARDING_REPOSITORY = Symbol('ReadAgencyOnboardingRepository');

export interface ReadAgencyOnboardingRepository {
  /** `null` when the agency does not exist or the user has no active membership in it. */
  findForMember(agencyId: string, userId: string): Promise<AgencyOnboardingReadModel | null>;
}
