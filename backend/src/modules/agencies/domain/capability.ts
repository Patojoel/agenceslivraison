import { UserId } from '@shared/domain/value-objects/user-id';
import { InvalidAgencyField } from './exceptions/agency.exceptions';
import { SuspensionReason } from './value-objects/suspension-reason';

export const CAPABILITY_TYPES = ['delivery', 'storage'] as const;
export type CapabilityType = typeof CAPABILITY_TYPES[number];

export function isCapabilityType(value: string): value is CapabilityType {
  return CAPABILITY_TYPES.some(type => type === value);
}

export function capabilityTypeOf(raw: string): CapabilityType {
  if (!isCapabilityType(raw)) throw new InvalidAgencyField('capability');
  return raw;
}

/** What an agency must have before a capability can be active. */
export type CapabilityRequirement = 'active_zone' | 'active_site';

export const REQUIREMENT_OF: Readonly<Record<CapabilityType, CapabilityRequirement>> = {
  delivery: 'active_zone',
  storage: 'active_site',
};

export type CapabilityTransitionKind = 'activated' | 'suspended';

/** One step in the life of a capability; the list only grows, so earlier suspensions and their reasons stay readable. */
export interface CapabilityTransition {
  readonly type: CapabilityType;
  readonly kind: CapabilityTransitionKind;
  /** 1 for the first transition of this capability, then one more each time. */
  readonly sequence: number;
  readonly occurredAt: Date;
  readonly actorId: UserId;
  readonly reason: SuspensionReason | null;
}

export interface CapabilityState {
  readonly type: CapabilityType;
  readonly state: 'active' | 'suspended';
  readonly since: Date;
  readonly reason: string | null;
  readonly acceptsNewRequests: boolean;
}
