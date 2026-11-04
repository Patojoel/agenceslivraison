import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_LOG, AuditEntry, AuditLog } from '@shared/application/ports/audit-log.port';
import { DomainEventSubscriber } from '@shared/application/ports/domain-event-publisher.port';
import { DomainEvent } from '@shared/domain/domain-event';
import { isPricingEvent, PricingEvent } from '../../domain/events/pricing-events';

/**
 * The trace names the resource (rate card or quote) and the author: never a price, a weight, a zone, nor who a quote is for.
 * The rate card traces also carry the version number, as `version:<n>` in `fields`: rows written so far have that form,
 * and the audit history is never rewritten, so the form is kept rather than split in two.
 */
function toAuditEntry(event: PricingEvent): AuditEntry {
  switch (event.type) {
    case 'RateCardCreated': return { userId: event.actorId, action: 'pricing.rate_card_created', agencyId: event.agencyId, resourceId: event.rateCardId, details: { fields: [`version:${event.version}`] } };
    case 'RateCardVersioned': return { userId: event.actorId, action: 'pricing.rate_card_versioned', agencyId: event.agencyId, resourceId: event.rateCardId, details: { fields: [`version:${event.version}`] } };
    case 'QuoteIssued': return { userId: event.actorId, action: 'pricing.quote_issued', agencyId: event.agencyId, resourceId: event.quoteId };
    case 'QuoteAccepted': return { userId: event.actorId, action: 'pricing.quote_accepted', agencyId: event.agencyId, resourceId: event.quoteId };
  }
}

@Injectable()
export class PricingAuditSubscriber implements DomainEventSubscriber {
  constructor(@Inject(AUDIT_LOG) private readonly audit: AuditLog) {}

  async handle(event: DomainEvent): Promise<void> {
    if (!isPricingEvent(event)) return;
    await this.audit.record(toAuditEntry(event));
  }
}
