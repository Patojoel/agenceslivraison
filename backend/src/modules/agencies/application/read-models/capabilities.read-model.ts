import { Agency } from '../../domain/agency';
import { CapabilityStateReadModel } from './agency-onboarding.read-model';

/** What the capability actions answer: every capability the agency ever enabled, and whether it is hybrid. */
export interface CapabilitiesReadModel {
  readonly capabilities: readonly CapabilityStateReadModel[];
  readonly hybrid: boolean;
}

export function toCapabilitiesReadModel(agency: Agency): CapabilitiesReadModel {
  return {
    capabilities: agency.capabilityStates().map(state => ({ ...state, since: state.since.toISOString() })),
    hybrid: agency.isHybrid(),
  };
}
