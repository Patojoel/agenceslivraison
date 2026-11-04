import { AgencyStatus } from '../../domain/agency.snapshot';

export interface CapabilityStateReadModel {
  readonly type: 'delivery' | 'storage';
  readonly state: 'active' | 'suspended';
  readonly since: string;
  readonly reason: string | null;
  readonly acceptsNewRequests: boolean;
}

/** What is stored about an agency's onboarding: identity is only known as filled or not, never its values. */
export interface AgencyOnboardingReadModel {
  readonly status: AgencyStatus;
  readonly submission: { readonly submittedAt: string; readonly submittedBy: string } | null;
  readonly identity: {
    readonly legalName: boolean;
    readonly headquartersCity: boolean;
    readonly headquartersAddress: boolean;
    readonly primaryPhone: boolean;
  };
  readonly capabilities: readonly CapabilityStateReadModel[];
  readonly activeZones: number;
  readonly activeSites: number;
}
