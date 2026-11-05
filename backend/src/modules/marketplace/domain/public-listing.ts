import { AgencyPublicView, PublicCapability } from './agency-public-view';
import { PublicProfileSnapshot } from './agency-public-profile';
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
  readonly publishedAt: Date;
  readonly visible: boolean;
}

function singleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function keyOf(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function composePublicListing(profile: PublicProfileSnapshot, view: AgencyPublicView, startingPrices: ReadonlyMap<string, number>): PublicListing {
  const name = singleLine(view.tradeName);
  const zones = [...view.zones]
    .sort((left, right) => keyOf(left.city).localeCompare(keyOf(right.city)) || keyOf(left.district ?? '').localeCompare(keyOf(right.district ?? '')) || left.id.localeCompare(right.id))
    .map(zone => ({ id: zone.id, city: zone.city, district: zone.district, startingPrice: startingPrices.get(zone.id) ?? null }));
  return {
    agencyId: profile.agencyId.value,
    slug: profile.slug.value,
    name,
    nameKey: keyOf(name),
    description: view.description,
    verification: 'unverified',
    capabilities: [...view.capabilities].sort(),
    zones,
    siteCities: [...view.siteCities],
    publishedAt: profile.publishedAt,
    visible: profile.published && obstaclesOf(profile.agencyId.value, view).length === 0,
  };
}
