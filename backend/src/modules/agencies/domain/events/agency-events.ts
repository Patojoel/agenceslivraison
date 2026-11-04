import { DomainEvent } from '@shared/domain/domain-event';
import { IdentityField, ProfileField } from '../agency-identity';
import { SiteField } from '../agency-site';
import { CapabilityType } from '../capability';

export type AgencyEvent =
  | { readonly type: 'AgencyRegistered'; readonly agencyId: string; readonly actorId: string }
  | { readonly type: 'AgencyIdentityUpdated'; readonly agencyId: string; readonly actorId: string; readonly fields: readonly IdentityField[] }
  | { readonly type: 'AgencyProfileUpdated'; readonly agencyId: string; readonly actorId: string; readonly fields: readonly ProfileField[] }
  | { readonly type: 'ServiceZoneAdded'; readonly agencyId: string; readonly actorId: string; readonly zoneId: string; readonly reactivated: boolean }
  | { readonly type: 'ServiceZoneRetired'; readonly agencyId: string; readonly actorId: string; readonly zoneId: string }
  | { readonly type: 'AgencySiteCreated'; readonly agencyId: string; readonly actorId: string; readonly siteId: string }
  | { readonly type: 'AgencySiteUpdated'; readonly agencyId: string; readonly actorId: string; readonly siteId: string; readonly fields: readonly SiteField[] }
  | { readonly type: 'AgencySiteDeactivated'; readonly agencyId: string; readonly actorId: string; readonly siteId: string }
  | { readonly type: 'AgencySiteReactivated'; readonly agencyId: string; readonly actorId: string; readonly siteId: string }
  | { readonly type: 'AgencySubmittedForVerification'; readonly agencyId: string; readonly actorId: string }
  | { readonly type: 'AgencyCapabilityEnabled'; readonly agencyId: string; readonly actorId: string; readonly capability: CapabilityType }
  | { readonly type: 'AgencyCapabilitySuspended'; readonly agencyId: string; readonly actorId: string; readonly capability: CapabilityType }
  | { readonly type: 'InvitationIssued'; readonly agencyId: string; readonly actorId: string }
  | { readonly type: 'InvitationAccepted'; readonly agencyId: string; readonly userId: string }
  | { readonly type: 'MembershipRoleChanged'; readonly agencyId: string; readonly actorId: string; readonly subjectUserId: string }
  | { readonly type: 'MembershipRevoked'; readonly agencyId: string; readonly actorId: string; readonly subjectUserId: string };

const TYPES: ReadonlySet<string> = new Set<AgencyEvent['type']>([
  'AgencyRegistered', 'AgencyIdentityUpdated', 'AgencyProfileUpdated', 'AgencySubmittedForVerification',
  'ServiceZoneAdded', 'ServiceZoneRetired',
  'AgencySiteCreated', 'AgencySiteUpdated', 'AgencySiteDeactivated', 'AgencySiteReactivated',
  'AgencyCapabilityEnabled', 'AgencyCapabilitySuspended',
  'InvitationIssued', 'InvitationAccepted', 'MembershipRoleChanged', 'MembershipRevoked',
]);

export function isAgencyEvent(event: DomainEvent): event is AgencyEvent {
  return TYPES.has(event.type);
}
