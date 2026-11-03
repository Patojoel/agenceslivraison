import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_LOG, AuditEntry, AuditLog } from '@shared/application/ports/audit-log.port';
import { DomainEventSubscriber } from '@shared/application/ports/domain-event-publisher.port';
import { DomainEvent } from '@shared/domain/domain-event';
import { AgencyEvent, isAgencyEvent } from '../../domain/events/agency-events';

function toAuditEntry(event: AgencyEvent): AuditEntry {
  switch (event.type) {
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
