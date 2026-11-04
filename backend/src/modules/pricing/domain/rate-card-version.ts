import { UserId } from '@shared/domain/value-objects/user-id';
import { InvalidPricingField } from './exceptions/pricing.exceptions';
import { RateCardContent } from './rate-card-content';
import { Dimensions } from './value-objects/dimensions';
import { Weight } from './value-objects/weight';
import { ZoneId } from './value-objects/zone-id';

export const MAX_PARCELS_PER_QUOTE = 20;

export interface RawParcel {
  readonly weight: string;
  readonly dimensions: { readonly length: number; readonly width: number; readonly height: number } | null;
}

export interface QuotedParcel {
  readonly taxableGrams: number;
  /** `null` when the parcel is heavier than the last bound of the zone. */
  readonly price: number | null;
}

export type QuoteResult =
  | { readonly status: 'no_tariff' }
  | { readonly status: 'out_of_scale'; readonly parcels: readonly QuotedParcel[] }
  | { readonly status: 'priced'; readonly parcels: readonly QuotedParcel[]; readonly total: number };

/** Whole grams of volumetric weight, rounded up: exact integer arithmetic, no floating point on the way. */
function volumetricGrams(dimensions: Dimensions, divisor: number): number {
  const scaled = dimensions.volume * 1000;
  const remainder = scaled % divisor;
  return (scaled - remainder) / divisor + (remainder === 0 ? 0 : 1);
}

export interface MeasuredParcel {
  readonly weight: Weight;
  readonly dimensions: Dimensions | null;
}

/** Reads the parcels of a request: from 1 to 20, each with a weight and its unit, and dimensions that are all there or not at all. */
export function measureParcels(rawParcels: readonly RawParcel[]): readonly MeasuredParcel[] {
  if (rawParcels.length < 1 || rawParcels.length > MAX_PARCELS_PER_QUOTE) throw new InvalidPricingField('parcels');
  return rawParcels.map(parcel => ({
    weight: Weight.measured(parcel.weight),
    dimensions: parcel.dimensions === null ? null : Dimensions.of(parcel.dimensions.length, parcel.dimensions.width, parcel.dimensions.height),
  }));
}

/** One immutable version of the scale, once written it never changes: a change is the next version. */
export class RateCardVersion {
  constructor(readonly number: number, readonly content: RateCardContent, readonly createdBy: UserId, readonly createdAt: Date) {}

  /**
   * The price of each parcel to a zone, from the version itself: the taxable weight is the greater of the real weight and
   * the volumetric one (when the version has a divisor and the parcel its dimensions), and the price that of the first
   * tier whose bound reaches it. One calculation serves the simulation and, later, the quotes.
   */
  quote(zoneId: string, rawParcels: readonly RawParcel[]): QuoteResult {
    const parcels = measureParcels(rawParcels);
    const line = this.content.lineOf(ZoneId.of(zoneId));
    if (!line) return { status: 'no_tariff' };
    const divisor = this.content.divisor?.value ?? null;
    const quoted = parcels.map((parcel): QuotedParcel => {
      const volumetric = divisor !== null && parcel.dimensions !== null ? volumetricGrams(parcel.dimensions, divisor) : 0;
      const taxableGrams = Math.max(parcel.weight.grams, volumetric);
      const tier = line.tiers.find(candidate => candidate.upTo.grams >= taxableGrams);
      return { taxableGrams, price: tier ? tier.price.value : null };
    });
    const prices = quoted.map(parcel => parcel.price);
    if (prices.some(price => price === null)) return { status: 'out_of_scale', parcels: quoted };
    return { status: 'priced', parcels: quoted, total: prices.reduce<number>((sum, price) => sum + (price ?? 0), 0) };
  }
}
