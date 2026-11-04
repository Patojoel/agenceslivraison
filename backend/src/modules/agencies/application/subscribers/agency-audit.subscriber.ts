import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_LOG, AuditEntry, AuditLog } from '@shared/application/ports/audit-log.port';
import { DomainEventSubscriber } from '@shared/application/ports/domain-event-publisher.port';
import { DomainEvent } from '@shared/domain/domain-event';
import { AgencyEvent, isAgencyEvent } from '../../domain/events/agency-events';

function toAuditEntry(event: AgencyEvent): AuditEntry {
  switch (event.type) {
    case 'AgencyRegistered':
      return { userId: event.actorId, action: 'agency.created', agencyId: event.agencyId };
    case 'AgencyIdentityUpdated':
      return { userId: event.actorId, action: 'agency.identity_updated', agencyId: event.agencyId, details: { fields: event.fields } };
    case 'AgencyProfileUpdated':
      return { userId: event.actorId, action: 'agency.profile_updated', agencyId: event.agencyId, details: { fields: event.fields } };
    case 'AgencySubmittedForVerification':
      return { userId: event.actorId, action: 'agency.submitted', agencyId: event.agencyId };
    case 'ServiceZoneAdded':
      return { userId: event.actorId, action: event.reactivated ? 'agency.zone_reactivated' : 'agency.zone_added', agencyId: event.agencyId, resourceId: event.zoneId };
    case 'ServiceZoneRetired':
      return { userId: event.actorId, action: 'agency.zone_retired', agencyId: event.agencyId, resourceId: event.zoneId };
    case 'AgencySiteCreated':
      return { userId: event.actorId, action: 'agency.site_created', agencyId: event.agencyId, resourceId: event.siteId };
    case 'AgencySiteUpdated':
      return { userId: event.actorId, action: 'agency.site_updated', agencyId: event.agencyId, resourceId: event.siteId, details: { fields: event.fields } };
    case 'AgencySiteDeactivated':
      return { userId: event.actorId, action: 'agency.site_deactivated', agencyId: event.agencyId, resourceId: event.siteId };
    case 'AgencySiteReactivated':
      return { userId: event.actorId, action: 'agency.site_reactivated', agencyId: event.agencyId, resourceId: event.siteId };
    case 'AgencyCapabilityEnabled':
      return { userId: event.actorId, action: 'agency.capability_enabled', agencyId: event.agencyId, details: { fields: [event.capability] } };
    case 'AgencyCapabilitySuspended':
      return { userId: event.actorId, action: 'agency.capability_suspended', agencyId: event.agencyId, details: { fields: [event.capability] } };
    case 'InvitationIssued':
      return { userId: event.actorId, action: 'invitation.created', agencyId: event.agencyId };
    case 'InvitationAccepted':
      return { userId: event.userId, action: 'invitation.accepted', agencyId: event.agencyId, subjectUserId: event.userId };
    case 'MembershipRoleChanged':
      return { userId: event.actorId, action: 'membership.role_changed', agencyId: event.agencyId, subjectUserId: event.subjectUserId };
    case 'MembershipRevoked':
      return { userId: event.actorId, action: 'membership.removed', agencyId: event.agencyId, subjectUserId: event.subjectUserId };
  }
}

@Injectable()
export class AgencyAuditSubscriber implements DomainEventSubscriber {
  constructor(@Inject(AUDIT_LOG) private readonly audit: AuditLog) {}

  async handle(event: DomainEvent): Promise<void> {
    if (!isAgencyEvent(event)) return;
    await this.audit.record(toAuditEntry(event));
  }
}
