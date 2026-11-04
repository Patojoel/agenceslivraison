import { AgencyStatus } from './agency.snapshot';

export const ONBOARDING_PREREQUISITES = [
  'legal_name', 'headquarters_city', 'headquarters_address', 'primary_phone', 'active_capability', 'active_site',
] as const;
export type OnboardingPrerequisiteCode = typeof ONBOARDING_PREREQUISITES[number];

/** What is known about an agency, without the values of its identity. */
export interface OnboardingFacts {
  readonly status: AgencyStatus;
  readonly identity: {
    readonly legalName: boolean;
    readonly headquartersCity: boolean;
    readonly headquartersAddress: boolean;
    readonly primaryPhone: boolean;
  };
  readonly activeCapabilities: number;
  readonly activeSites: number;
}

export interface OnboardingPrerequisite {
  readonly code: OnboardingPrerequisiteCode;
  readonly filled: boolean;
}

export interface OnboardingEvaluation {
  readonly prerequisites: readonly OnboardingPrerequisite[];
  readonly readyForSubmission: boolean;
}

/** The single definition of what an agency needs before it can be submitted, shared by the onboarding state and the submission. */
export function evaluateOnboarding(facts: OnboardingFacts): OnboardingEvaluation {
  const filled: Record<OnboardingPrerequisiteCode, boolean> = {
    legal_name: facts.identity.legalName,
    headquarters_city: facts.identity.headquartersCity,
    headquarters_address: facts.identity.headquartersAddress,
    primary_phone: facts.identity.primaryPhone,
    active_capability: facts.activeCapabilities > 0,
    active_site: facts.activeSites > 0,
  };
  const prerequisites = ONBOARDING_PREREQUISITES.map(code => ({ code, filled: filled[code] }));
  return { prerequisites, readyForSubmission: facts.status === 'draft' && prerequisites.every(item => item.filled) };
}
