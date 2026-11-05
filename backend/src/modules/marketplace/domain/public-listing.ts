import { AgencyPublicView, PublicCapability } from './agency-public-view';
import { PublicProfileSnapshot } from './agency-public-profile';
import { areaKeyOf, comparisonKeyOf, singleLineOf } from './comparison-key';
import { obstaclesOf } from './publication-rules';

export interface PublicListingZone {
  readonly id: string;
  readonly city: string;
  readonly district: string | null;
  /** The lowest price of the rate card in force for this zone, in XAF; `null` when the zone is on quote. */
  readonly startingPrice: number | null;
}

/**
 * The closed list of what the marketplace may say of an agency (D-23). A field is added here, in the projection table and in
 * the test of the closed list together, or not at all: there is no legal name, no phone, no e-mail, no registration number,
 * no address, nothing of the team. `agencyId` is the key of the projection and never leaves the module.
 */
export interface PublicListing {
  readonly agencyId: string;
  readonly slug: string;
  readonly name: string;
  /** The comparison form of the name (no case, accents or repeated spaces): what the directory sorts and searches on. */
  readonly nameKey: string;
  readonly description: string | null;
  /** Always `unverified` until the platform administrators approve agencies (B10). */
  readonly verification: 'unverified';
  readonly capabilities: readonly PublicCapability[];
  readonly zones: readonly PublicListingZone[];
  readonly siteCities: readonly string[];
  /** Search key, never shown: the cities (comparison form) of the active zones and sites. What the city filter reads. */
  readonly cityKeys: readonly string[];
  /** Search key, never shown: one per active zone, its city and its district (empty for a whole city). What the district filter reads. */
  readonly districtKeys: readonly string[];
  readonly publishedAt: Date;
  readonly visible: boolean;
}

function keyOf(text: string): string {
  return comparisonKeyOf(singleLineOf(text));
}

function distinctSorted(keys: Iterable<string>): string[] {
  return [...new Set(keys)].sort();
}

export function composePublicListing(profile: PublicProfileSnapshot, view: AgencyPublicView, startingPrices: ReadonlyMap<string, number>): PublicListing {
  const name = singleLineOf(view.tradeName);
  const zones = [...view.zones]
    .sort((left, right) => keyOf(left.city).localeCompare(keyOf(right.city)) || keyOf(left.district ?? '').localeCompare(keyOf(right.district ?? '')) || left.id.localeCompare(right.id))
    .map(zone => ({ id: zone.id, city: zone.city, district: zone.district, startingPrice: startingPrices.get(zone.id) ?? null }));
  return {
    agencyId: profile.agencyId.value,
    slug: profile.slug.value,
    name,
    nameKey: comparisonKeyOf(name),
    description: view.description,
    verification: 'unverified',
    capabilities: [...view.capabilities].sort(),
    zones,
    siteCities: [...view.siteCities],
    cityKeys: distinctSorted([...view.zones.map(zone => keyOf(zone.city)), ...view.siteCities.map(keyOf)]),
    districtKeys: distinctSorted(view.zones.map(zone => areaKeyOf(keyOf(zone.city), zone.district === null ? '' : keyOf(zone.district)))),
    publishedAt: profile.publishedAt,
    visible: profile.published && obstaclesOf(profile.agencyId.value, view).length === 0,
  };
}
