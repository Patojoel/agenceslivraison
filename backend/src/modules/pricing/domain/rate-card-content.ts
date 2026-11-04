import { InvalidPricingField } from './exceptions/pricing.exceptions';
import { Price } from './value-objects/price';
import { VolumetricDivisor } from './value-objects/volumetric-divisor';
import { Weight } from './value-objects/weight';
import { ZoneId } from './value-objects/zone-id';

export const MAX_ZONES_PER_VERSION = 100;
export const MAX_TIERS_PER_ZONE = 20;

/** Up to this weight (included), the parcel costs this price. */
export interface WeightTier {
  readonly upTo: Weight;
  readonly price: Price;
}

/** The tiers of one destination zone, from the lightest bound to the heaviest. */
export interface RateCardLine {
  readonly zoneId: ZoneId;
  readonly tiers: readonly WeightTier[];
}

export interface RawTier {
  readonly upTo: string;
  readonly price: number;
}

export interface RawLine {
  readonly zoneId: string;
  readonly tiers: readonly RawTier[];
}

function tiersOf(raw: readonly RawTier[]): readonly WeightTier[] {
  if (raw.length < 1 || raw.length > MAX_TIERS_PER_ZONE) throw new InvalidPricingField('tiers');
  const tiers = raw.map(tier => ({ upTo: Weight.bound(tier.upTo), price: Price.of(tier.price) }));
  tiers.forEach((tier, index) => {
    const previous = tiers[index - 1];
    if (previous && tier.upTo.grams <= previous.upTo.grams) throw new InvalidPricingField('tiers');
  });
  return tiers;
}

/**
 * The complete scale of a version: for each priced zone, tiers of weight with a price, plus an optional
 * volumetric divisor. Immutable and always valid; lines are kept ordered by zone so that two scales that say the
 * same thing are equal whatever the order they were written in.
 */
export class RateCardContent {
  private constructor(readonly divisor: VolumetricDivisor | null, readonly lines: readonly RateCardLine[]) {}

  static of(divisor: number | null | undefined, rawLines: readonly RawLine[]): RateCardContent {
    if (rawLines.length < 1 || rawLines.length > MAX_ZONES_PER_VERSION) throw new InvalidPricingField('lines');
    const lines = rawLines.map(line => ({ zoneId: ZoneId.of(line.zoneId), tiers: tiersOf(line.tiers) }));
    if (new Set(lines.map(line => line.zoneId.value)).size !== lines.length) throw new InvalidPricingField('lines');
    const ordered = [...lines].sort((left, right) => (left.zoneId.value < right.zoneId.value ? -1 : 1));
    return new RateCardContent(divisor === null || divisor === undefined ? null : VolumetricDivisor.of(divisor), ordered);
  }

  /** The scale rebuilt from storage: it was valid when written. */
  static reconstitute(divisor: VolumetricDivisor | null, lines: readonly RateCardLine[]): RateCardContent {
    return new RateCardContent(divisor, lines);
  }

  lineOf(zoneId: ZoneId): RateCardLine | undefined {
    return this.lines.find(line => line.zoneId.equals(zoneId));
  }

  fingerprint(): string {
    return JSON.stringify([this.divisor?.value ?? null, this.lines.map(line => [line.zoneId.value, line.tiers.map(tier => [tier.upTo.grams, tier.price.value])])]);
  }
}
