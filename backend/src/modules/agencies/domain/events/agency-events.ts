import { DomainEvent } from '../../../../shared/domain/domain-event';

export type AgencyEvent =
  | { readonly type: 'InvitationIssued'; readonly agencyId: string; readonly actorId: string }
  | { readonly type: 'InvitationAccepted'; readonly agencyId: string; readonly userId: string }
  | { readonly type: 'MembershipRoleChanged'; readonly agencyId: string; readonly actorId: string; readonly subjectUserId: string }
  | { readonly type: 'MembershipRevoked'; readonly agencyId: string; readonly actorId: string; readonly subjectUserId: string };

const TYPES: ReadonlySet<string> = new Set<AgencyEvent['type']>(['InvitationIssued', 'InvitationAccepted', 'MembershipRoleChanged', 'MembershipRevoked']);

export function isAgencyEvent(event: DomainEvent): event is AgencyEvent {
  return TYPES.has(event.type);
}
