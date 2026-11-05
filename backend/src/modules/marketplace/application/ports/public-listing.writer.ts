import { PublicListing } from '../../domain/public-listing';

/** The write side of the projection: one row per agency that has a profile, rewritten whole, so that it is idempotent. */
export interface PublicListingWriter {
  upsert(listing: PublicListing, now: Date): Promise<void>;
}

export const PUBLIC_LISTING_WRITER = Symbol('PublicListingWriter');
