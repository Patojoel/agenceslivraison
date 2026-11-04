import { RateCardVersion } from '../../domain/rate-card-version';
import { DeliveryZone } from '../ports/agency-access.port';

export interface TierRecord {
  readonly upToGrams: number;
  readonly price: number;
}

export interface LineRecord {
  readonly zoneId: string;
  readonly tiers: readonly TierRecord[];
}

/** A version as stored, without any label: what the read repository returns. */
export interface RateCardVersionRecord {
  readonly rateCardId: string;
  readonly number: number;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly volumetricDivisor: number | null;
  readonly lines: readonly LineRecord[];
}

export interface VersionSummaryReadModel {
  readonly number: number;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly volumetricDivisor: number | null;
  readonly zoneCount: number;
}

export interface LineReadModel extends LineRecord {
  /** The label of the zone as the agency writes it now; `null` only if the zone is not known to the agency (never expected). */
  readonly city: string | null;
  readonly district: string | null;
  readonly zoneStatus: 'active' | 'retired' | 'unknown';
}

export interface RateCardVersionReadModel {
  readonly number: number;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly volumetricDivisor: number | null;
  readonly currency: 'XAF';
  readonly zones: readonly LineReadModel[];
}

export interface RateCardReadModel {
  readonly id: string;
  readonly version: RateCardVersionReadModel;
}

export function recordOfVersion(rateCardId: string, version: RateCardVersion): RateCardVersionRecord {
  return {
    rateCardId,
    number: version.number,
    createdAt: version.createdAt.toISOString(),
    createdBy: version.createdBy.value,
    volumetricDivisor: version.content.divisor?.value ?? null,
    lines: version.content.lines.map(line => ({ zoneId: line.zoneId.value, tiers: line.tiers.map(tier => ({ upToGrams: tier.upTo.grams, price: tier.price.value })) })),
  };
}

/** Adds to each line the label and status of its zone, read from the agency now; the prices are those of the version. */
export function toRateCardReadModel(record: RateCardVersionRecord, zones: readonly DeliveryZone[]): RateCardReadModel {
  const byId = new Map(zones.map(zone => [zone.id, zone]));
  return {
    id: record.rateCardId,
    version: {
      number: record.number,
      createdAt: record.createdAt,
      createdBy: record.createdBy,
      volumetricDivisor: record.volumetricDivisor,
      currency: 'XAF',
      zones: record.lines.map(line => {
        const zone = byId.get(line.zoneId);
        return { ...line, city: zone?.city ?? null, district: zone?.district ?? null, zoneStatus: zone === undefined ? 'unknown' : zone.active ? 'active' : 'retired' };
      }),
    },
  };
}
