import { AgencyStatus } from '../../../domain/agency.snapshot';
import { OnboardingPrerequisite } from '../../../domain/onboarding-requirements';
import { AgencyOnboardingReadModel, CapabilityStateReadModel } from '../../read-models/agency-onboarding.read-model';

export interface GetAgencyOnboardingResponse {
  readonly status: AgencyStatus;
  readonly submission: AgencyOnboardingReadModel['submission'];
  readonly prerequisites: readonly OnboardingPrerequisite[];
  readonly readyForSubmission: boolean;
  readonly capabilities: readonly CapabilityStateReadModel[];
  readonly hybrid: boolean;
  readonly activeZones: number;
  readonly activeSites: number;
}
