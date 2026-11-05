import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_LOG, AuditEntry, AuditLog } from '@shared/application/ports/audit-log.port';
import { DomainEventSubscriber } from '@shared/application/ports/domain-event-publisher.port';
import { DomainEvent } from '@shared/domain/domain-event';
import { isMarketplaceEvent, MarketplaceEvent } from '../../domain/events/marketplace-events';

/** The trace names the agency and the author: never the name, the description, the address or a price. */
function toAuditEntry(event: MarketplaceEvent): AuditEntry {
  switch (event.type) {
    case 'AgencyPublicProfilePublished': return { userId: event.actorId, action: 'marketplace.profile_published', agencyId: event.agencyId, resourceId: event.agencyId };
    case 'AgencyPublicProfileUnpublished': return { userId: event.actorId, action: 'marketplace.profile_unpublished', agencyId: event.agencyId, resourceId: event.agencyId };
  }
}

@Injectable()
export class MarketplaceAuditSubscriber implements DomainEventSubscriber {
  constructor(@Inject(AUDIT_LOG) private readonly audit: AuditLog) {}

  async handle(event: DomainEvent): Promise<void> {
    if (!isMarketplaceEvent(event)) return;
    await this.audit.record(toAuditEntry(event));
  }
}
