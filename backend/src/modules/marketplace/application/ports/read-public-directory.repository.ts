import { PublicCapability } from '../../domain/agency-public-view';
import { PublicCursorPosition } from '../../domain/value-objects/public-cursor';
import { PublicSearchCriteria } from '../../domain/value-objects/public-search-criteria';

export interface PublicZoneRecord {
  readonly city: string;
  readonly district: string | null;
  readonly startingPrice: number | null;
}

/** A visible row of the projection, minus the identifier of the agency and the search keys: what the directory may say, and the sort key. */
export interface PublicDirectoryRecord {
  readonly slug: string;
  readonly name: string;
  readonly nameKey: string;
  readonly description: string | null;
  readonly verification: 'unverified';
  readonly capabilities: readonly PublicCapability[];
  readonly zones: readonly PublicZoneRecord[];
  readonly siteCities: readonly string[];
  readonly publishedAt: Date;
}

/** Reads the visible rows of `public_agency_listings`, the projection of this module, and nothing else. */
export interface ReadPublicDirectoryRepository {
  /** At most `take` rows, in the order of the directory (name in comparison form, then slug), strictly after `after`. */
  search(criteria: PublicSearchCriteria, after: PublicCursorPosition | null, take: number): Promise<PublicDirectoryRecord[]>;
  findVisibleBySlug(slug: string): Promise<PublicDirectoryRecord | null>;
}

export const READ_PUBLIC_DIRECTORY_REPOSITORY = Symbol('ReadPublicDirectoryRepository');
