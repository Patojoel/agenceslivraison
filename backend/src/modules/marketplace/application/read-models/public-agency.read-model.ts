import { comparisonKeyOf, singleLineOf } from '../../domain/comparison-key';
import { PublicCapability } from '../../domain/agency-public-view';
import { PublicDirectoryRecord } from '../ports/read-public-directory.repository';

/** One line of the directory: the closed list of what a result may say (UC-03-02, D-23). */
export interface PublicAgencySummary {
  readonly slug: string;
  readonly tradeName: string;
  /** Always `unverified` ("non vérifiée") until the platform approves agencies (B10). */
  readonly verification: 'unverified';
  readonly capabilities: readonly PublicCapability[];
  /** Both capabilities active. */
  readonly hybrid: boolean;
  /** The cities of the active zones and sites, once each, in alphabetical order. */
  readonly cities: readonly string[];
}

export interface PublicAgencyZone {
  readonly city: string;
  readonly district: string | null;
  /** The lowest price of the rate card in force, in XAF; `null`: on quote. */
  readonly startingPrice: number | null;
}

/**
 * `indicative_not_guaranteed`: at least one zone shows a "from" price, which holds only until a quote says otherwise.
 * `on_quote`: no price is shown, the agency answers by quote.
 */
export type PublicPricingNotice = 'indicative_not_guaranteed' | 'on_quote';

export interface PublicAgencyDetail {
  readonly slug: string;
  readonly tradeName: string;
  /** Plain text, markup included as typed: the client escapes it on display. */
  readonly description: string | null;
  readonly verification: 'unverified';
  readonly capabilities: readonly PublicCapability[];
  readonly hybrid: boolean;
  readonly zones: readonly PublicAgencyZone[];
  readonly siteCities: readonly string[];
  readonly pricing: { readonly currency: 'XAF'; readonly notice: PublicPricingNotice };
  readonly publishedAt: string;
}

function isHybrid(record: PublicDirectoryRecord): boolean {
  return record.capabilities.includes('delivery') && record.capabilities.includes('storage');
}

function citiesOf(record: PublicDirectoryRecord): string[] {
  const byKey = new Map<string, string>();
  for (const city of [...record.zones.map(zone => zone.city), ...record.siteCities]) {
    const key = comparisonKeyOf(singleLineOf(city));
    if (!byKey.has(key)) byKey.set(key, city);
  }
  return [...byKey.entries()].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)).map(([, city]) => city);
}

export function toSummary(record: PublicDirectoryRecord): PublicAgencySummary {
  return {
    slug: record.slug,
    tradeName: record.name,
    verification: record.verification,
    capabilities: record.capabilities,
    hybrid: isHybrid(record),
    cities: citiesOf(record),
  };
}

export function toDetail(record: PublicDirectoryRecord): PublicAgencyDetail {
  const zones = record.zones.map(zone => ({ city: zone.city, district: zone.district, startingPrice: zone.startingPrice }));
  return {
    slug: record.slug,
    tradeName: record.name,
    description: record.description,
    verification: record.verification,
    capabilities: record.capabilities,
    hybrid: isHybrid(record),
    zones,
    siteCities: record.siteCities,
    pricing: { currency: 'XAF', notice: zones.some(zone => zone.startingPrice !== null) ? 'indicative_not_guaranteed' : 'on_quote' },
    publishedAt: record.publishedAt.toISOString(),
  };
}
