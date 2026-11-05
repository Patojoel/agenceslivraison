import { DomainEvent } from '@shared/domain/domain-event';

/** Identifiers only: never the name, the description or a price. */
export type MarketplaceEvent =
  | { readonly type: 'AgencyPublicProfilePublished'; readonly agencyId: string; readonly actorId: string }
  | { readonly type: 'AgencyPublicProfileUnpublished'; readonly agencyId: string; readonly actorId: string };

const TYPES: ReadonlySet<string> = new Set<MarketplaceEvent['type']>(['AgencyPublicProfilePublished', 'AgencyPublicProfileUnpublished']);

export function isMarketplaceEvent(event: DomainEvent): event is MarketplaceEvent {
  return TYPES.has(event.type);
}
