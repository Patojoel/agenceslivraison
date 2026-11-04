import { DomainEvent } from '@shared/domain/domain-event';
import { IdentityField, ProfileField } from '../agency-identity';

export type AgencyEvent =
  | { readonly type: 'AgencyRegistered'; readonly agencyId: string; readonly actorId: string }
  | { readonly type: 'AgencyIdentityUpdated'; readonly agencyId: string; readonly actorId: string; readonly fields: readonly IdentityField[] }
  | { readonly type: 'AgencyProfileUpdated'; readonly agencyId: string; readonly actorId: string; readonly fields: readonly ProfileField[] }
  | { readonly type: 'InvitationIssued'; readonly agencyId: string; readonly actorId: string }
  | { readonly type: 'InvitationAccepted'; readonly agencyId: string; readonly userId: string }
  | { readonly type: 'MembershipRoleChanged'; readonly agencyId: string; readonly actorId: string; readonly subjectUserId: string }
  | { readonly type: 'MembershipRevoked'; readonly agencyId: string; readonly actorId: string; readonly subjectUserId: string };

const TYPES: ReadonlySet<string> = new Set<AgencyEvent['type']>(['AgencyRegistered', 'AgencyIdentityUpdated', 'AgencyProfileUpdated', 'InvitationIssued', 'InvitationAccepted', 'MembershipRoleChanged', 'MembershipRevoked']);

export function isAgencyEvent(event: DomainEvent): event is AgencyEvent {
  return TYPES.has(event.type);
}
