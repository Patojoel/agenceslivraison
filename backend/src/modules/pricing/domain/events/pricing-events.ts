import { DomainEvent } from '@shared/domain/domain-event';

export type PricingEvent =
  | { readonly type: 'RateCardCreated'; readonly agencyId: string; readonly rateCardId: string; readonly actorId: string; readonly version: number }
  | { readonly type: 'RateCardVersioned'; readonly agencyId: string; readonly rateCardId: string; readonly actorId: string; readonly version: number };

const TYPES: ReadonlySet<string> = new Set<PricingEvent['type']>(['RateCardCreated', 'RateCardVersioned']);

export function isPricingEvent(event: DomainEvent): event is PricingEvent {
  return TYPES.has(event.type);
}
