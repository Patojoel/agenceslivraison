import { DomainEvent } from '@shared/domain/domain-event';

/** Identifiers only: never a name, a phone number or an amount. */
export type PricingEvent =
  | { readonly type: 'RateCardCreated'; readonly agencyId: string; readonly rateCardId: string; readonly actorId: string; readonly version: number }
  | { readonly type: 'RateCardVersioned'; readonly agencyId: string; readonly rateCardId: string; readonly actorId: string; readonly version: number }
  | { readonly type: 'QuoteIssued'; readonly agencyId: string; readonly quoteId: string; readonly actorId: string }
  | { readonly type: 'QuoteAccepted'; readonly agencyId: string; readonly quoteId: string; readonly actorId: string };

const TYPES: ReadonlySet<string> = new Set<PricingEvent['type']>(['RateCardCreated', 'RateCardVersioned', 'QuoteIssued', 'QuoteAccepted']);

export function isPricingEvent(event: DomainEvent): event is PricingEvent {
  return TYPES.has(event.type);
}
