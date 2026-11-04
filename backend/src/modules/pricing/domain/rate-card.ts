import { AggregateRoot } from '@shared/domain/aggregate-root';
import { UserId } from '@shared/domain/value-objects/user-id';
import { PricingEvent } from './events/pricing-events';
import { PricingZoneNotFound, PricingZoneRetired, StaleRateCardVersion } from './exceptions/pricing.exceptions';
import { RateCardContent } from './rate-card-content';
import { QuoteResult, RateCardVersion, RawParcel } from './rate-card-version';
import { AgencyId } from './value-objects/agency-id';
import { RateCardId } from './value-objects/rate-card-id';
import { ZoneDirectory } from './zone-directory';

export interface RateCardSnapshot {
  readonly id: RateCardId;
  readonly agencyId: AgencyId;
  /** The version in force: the earlier ones are history, read from storage, never loaded to change anything. */
  readonly current: RateCardVersion;
}

export interface NewRateCard {
  readonly id: RateCardId;
  readonly agencyId: AgencyId;
  readonly content: RateCardContent;
  readonly zones: ZoneDirectory;
  readonly authorId: UserId;
  readonly now: Date;
}

export interface NewVersion {
  /** The number of the version in force the author read. */
  readonly basedOn: number;
  readonly content: RateCardContent;
  readonly zones: ZoneDirectory;
  readonly authorId: UserId;
  readonly now: Date;
}

/** Only the zones the agency serves now can be priced: an unknown one (or one of another agency) first, then a retired one. */
function assertPricedZonesAreActive(content: RateCardContent, zones: ZoneDirectory): void {
  const statuses = content.lines.map(line => zones.statusOf(line.zoneId.value));
  if (statuses.includes('unknown')) throw new PricingZoneNotFound();
  if (statuses.includes('retired')) throw new PricingZoneRetired();
}

/**
 * The delivery rate card of an agency (one per agency): its versions are immutable, the last one is in force at once.
 * Versions are only ever added.
 */
export class RateCard extends AggregateRoot<PricingEvent> {
  private constructor(private readonly state: { readonly id: RateCardId; readonly agencyId: AgencyId; current: RateCardVersion }) {
    super();
  }

  static create(input: NewRateCard): RateCard {
    assertPricedZonesAreActive(input.content, input.zones);
    const card = new RateCard({ id: input.id, agencyId: input.agencyId, current: new RateCardVersion(1, input.content, input.authorId, input.now) });
    card.record({ type: 'RateCardCreated', agencyId: input.agencyId.value, rateCardId: input.id.value, actorId: input.authorId.value, version: 1 });
    return card;
  }

  static reconstitute(snapshot: RateCardSnapshot): RateCard {
    return new RateCard({ id: snapshot.id, agencyId: snapshot.agencyId, current: snapshot.current });
  }

  snapshot(): RateCardSnapshot {
    return { id: this.state.id, agencyId: this.state.agencyId, current: this.state.current };
  }

  /**
   * Adds the next version, in force at once, if the author based it on the version in force. A scale identical to the
   * one in force changes nothing and answers `false`.
   */
  publish(input: NewVersion): boolean {
    if (input.basedOn !== this.state.current.number) throw new StaleRateCardVersion();
    assertPricedZonesAreActive(input.content, input.zones);
    if (input.content.fingerprint() === this.state.current.content.fingerprint()) return false;
    this.state.current = new RateCardVersion(this.state.current.number + 1, input.content, input.authorId, input.now);
    this.record({ type: 'RateCardVersioned', agencyId: this.state.agencyId.value, rateCardId: this.state.id.value, actorId: input.authorId.value, version: this.state.current.number });
    return true;
  }

  /** Prices parcels to a zone with the version in force. */
  quote(zoneId: string, parcels: readonly RawParcel[]): QuoteResult {
    return this.state.current.quote(zoneId, parcels);
  }
}
