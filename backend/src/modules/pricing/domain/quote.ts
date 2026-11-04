import { AggregateRoot } from '@shared/domain/aggregate-root';
import { UserId } from '@shared/domain/value-objects/user-id';
import { PricingEvent } from './events/pricing-events';
import { DeliveryNotActive, PricingZoneNotFound, PricingZoneRetired, QuoteAlreadyAccepted, QuoteExpired, QuoteNotPriceable } from './exceptions/pricing.exceptions';
import { RateCard } from './rate-card';
import { measureParcels, QuoteResult, RawParcel } from './rate-card-version';
import { AgencyId } from './value-objects/agency-id';
import { ManualPrice } from './value-objects/manual-price';
import { QuoteId } from './value-objects/quote-id';
import { QuoteReference } from './value-objects/quote-reference';
import { Recipient } from './value-objects/recipient';
import { ZoneId } from './value-objects/zone-id';
import { ZoneView } from './zone-directory';

export const QUOTE_VALIDITY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type QuotePricing = 'priced' | 'out_of_scale' | 'no_tariff';
/** `expired` is never written: it is what an issued quote becomes when its validity date has passed. */
export type QuoteState = 'issued' | 'accepted' | 'expired';

/** A parcel as it was quoted: the figures of the day, copied, so that no later change of the rate card reaches them. */
export interface QuoteParcel {
  readonly weightGrams: number;
  readonly dimensions: { readonly length: number; readonly width: number; readonly height: number } | null;
  /** `null` when the zone had no tariff: nothing was calculated. */
  readonly taxableGrams: number | null;
  /** `null` when the parcel was out of the scale or the zone had no tariff. */
  readonly price: number | null;
}

export interface QuoteSnapshot {
  readonly id: QuoteId;
  readonly agencyId: AgencyId;
  readonly reference: QuoteReference;
  readonly recipient: Recipient;
  readonly zone: { readonly id: ZoneId; readonly city: string; readonly district: string | null };
  readonly parcels: readonly QuoteParcel[];
  /** The version of the rate card the calculation used; `null` when the agency had no rate card. */
  readonly rateCardVersion: number | null;
  readonly pricing: QuotePricing;
  readonly calculatedTotal: number | null;
  readonly manual: ManualPrice | null;
  /** What the quote commits the agency to: the manual price when there is one, the calculated total otherwise. */
  readonly total: number;
  readonly issuedAt: Date;
  readonly issuedBy: UserId;
  readonly validUntil: Date;
  readonly status: 'issued' | 'accepted';
  readonly acceptedAt: Date | null;
  readonly acceptedBy: UserId | null;
}

export interface QuoteIssueInput {
  readonly id: QuoteId;
  readonly agencyId: AgencyId;
  readonly reference: QuoteReference;
  readonly recipient: Recipient;
  /** The zone as the agency says it now; `null` when the agency has no such zone. */
  readonly zone: ZoneView | null;
  readonly deliveryActive: boolean;
  /** The rate card in force, `null` for an agency without one. */
  readonly rateCard: RateCard | null;
  readonly parcels: readonly RawParcel[];
  readonly manual: ManualPrice | null;
  readonly issuedBy: UserId;
  readonly now: Date;
}

export interface QuoteAcceptInput {
  readonly actorId: UserId;
  readonly now: Date;
  readonly zone: ZoneView | null;
  readonly deliveryActive: boolean;
}

type State = { -readonly [K in keyof QuoteSnapshot]: QuoteSnapshot[K] };

/** The zone must exist, be served and be delivered by an active capability: a retired zone or a suspended delivery commits to nothing. */
function assertDeliverable(zone: ZoneView | null, deliveryActive: boolean): ZoneView {
  if (!zone) throw new PricingZoneNotFound();
  if (!zone.active) throw new PricingZoneRetired();
  if (!deliveryActive) throw new DeliveryNotActive();
  return zone;
}

/**
 * A price promised to a recipient for a valid week. It is written once with a complete copy of the calculation (version,
 * zone label, parcels, prices): nothing in it ever follows the rate card again. The only change it knows is its acceptance,
 * which can happen once.
 */
export class Quote extends AggregateRoot<PricingEvent> {
  private constructor(private readonly state: State) {
    super();
  }

  static issue(input: QuoteIssueInput): Quote {
    const measured = measureParcels(input.parcels);
    const zone = assertDeliverable(input.zone, input.deliveryActive);
    const result: QuoteResult = input.rateCard ? input.rateCard.quote(zone.id, input.parcels) : { status: 'no_tariff' };
    const calculatedTotal = result.status === 'priced' ? result.total : null;
    const total = input.manual?.price ?? calculatedTotal;
    if (total === null) throw new QuoteNotPriceable();
    const parcels = measured.map((parcel, index): QuoteParcel => {
      const quoted = result.status === 'no_tariff' ? undefined : result.parcels[index];
      return {
        weightGrams: parcel.weight.grams,
        dimensions: parcel.dimensions === null ? null : { length: parcel.dimensions.length, width: parcel.dimensions.width, height: parcel.dimensions.height },
        taxableGrams: quoted?.taxableGrams ?? null,
        price: quoted?.price ?? null,
      };
    });
    const quote = new Quote({
      id: input.id, agencyId: input.agencyId, reference: input.reference, recipient: input.recipient,
      zone: { id: ZoneId.of(zone.id), city: zone.city, district: zone.district },
      parcels, rateCardVersion: input.rateCard?.snapshot().current.number ?? null, pricing: result.status,
      calculatedTotal, manual: input.manual, total,
      issuedAt: input.now, issuedBy: input.issuedBy, validUntil: new Date(input.now.getTime() + QUOTE_VALIDITY_DAYS * DAY_MS),
      status: 'issued', acceptedAt: null, acceptedBy: null,
    });
    quote.record({ type: 'QuoteIssued', agencyId: input.agencyId.value, quoteId: input.id.value, actorId: input.issuedBy.value });
    return quote;
  }

  static reconstitute(snapshot: QuoteSnapshot): Quote {
    return new Quote({ ...snapshot, parcels: [...snapshot.parcels] });
  }

  snapshot(): QuoteSnapshot {
    return { ...this.state, parcels: [...this.state.parcels] };
  }

  /** The state a person sees at a moment: the validity date itself is still valid, the millisecond after it is not. */
  stateAt(now: Date): QuoteState {
    if (this.state.status === 'accepted') return 'accepted';
    return now.getTime() > this.state.validUntil.getTime() ? 'expired' : 'issued';
  }

  /** Records the agreement of the recipient, once, while the quote is valid and its zone still delivered. */
  accept(input: QuoteAcceptInput): void {
    if (this.state.status === 'accepted') throw new QuoteAlreadyAccepted();
    if (this.stateAt(input.now) === 'expired') throw new QuoteExpired();
    assertDeliverable(input.zone, input.deliveryActive);
    this.state.status = 'accepted';
    this.state.acceptedAt = input.now;
    this.state.acceptedBy = input.actorId;
    this.record({ type: 'QuoteAccepted', agencyId: this.state.agencyId.value, quoteId: this.state.id.value, actorId: input.actorId.value });
  }
}
