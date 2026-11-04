import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_LOG, AuditEntry, AuditLog } from '@shared/application/ports/audit-log.port';
import { DomainEventSubscriber } from '@shared/application/ports/domain-event-publisher.port';
import { DomainEvent } from '@shared/domain/domain-event';
import { isPricingEvent, PricingEvent } from '../../domain/events/pricing-events';

/** The trace names the rate card and the version number: never a price, a weight or a zone. */
function toAuditEntry(event: PricingEvent): AuditEntry {
  const action = event.type === 'RateCardCreated' ? 'pricing.rate_card_created' : 'pricing.rate_card_versioned';
  return { userId: event.actorId, action, agencyId: event.agencyId, resourceId: event.rateCardId, details: { fields: [`version:${event.version}`] } };
}

@Injectable()
export class PricingAuditSubscriber implements DomainEventSubscriber {
  constructor(@Inject(AUDIT_LOG) private readonly audit: AuditLog) {}

  async handle(event: DomainEvent): Promise<void> {
    if (!isPricingEvent(event)) return;
    await this.audit.record(toAuditEntry(event));
  }
}
