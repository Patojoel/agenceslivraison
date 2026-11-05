import { Injectable } from "@nestjs/common";
import { TypeOrmDatabaseConnection } from "@shared/infrastructure/persistence/typeorm/typeorm-database-connection";
import { PublicListingWriter } from "../../../application/ports/public-listing.writer";
import { PublicListing } from "../../../domain/public-listing";

/** The row is written whole, so running it twice for one state leaves the same row. */
const UPSERT_LISTING = `
  INSERT INTO public_agency_listings
    (agency_id, slug, name, name_key, description, verification, capabilities, zones, site_cities, city_keys, district_keys, published_at, visible, updated_at)
  VALUES
    ($1::uuid, $2, $3, $4, $5::text, $6, $7::text[], $8::jsonb, $9::text[], $10::text[], $11::text[], $12::timestamptz, $13::boolean, $14::timestamptz)
  ON CONFLICT (agency_id) DO UPDATE SET
    slug = EXCLUDED.slug, name = EXCLUDED.name, name_key = EXCLUDED.name_key, description = EXCLUDED.description,
    verification = EXCLUDED.verification, capabilities = EXCLUDED.capabilities, zones = EXCLUDED.zones,
    site_cities = EXCLUDED.site_cities, city_keys = EXCLUDED.city_keys, district_keys = EXCLUDED.district_keys, published_at = EXCLUDED.published_at, visible = EXCLUDED.visible, updated_at = EXCLUDED.updated_at`;

@Injectable()
export class PublicListingTypeOrmWriter implements PublicListingWriter {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async upsert(listing: PublicListing, now: Date): Promise<void> {
    const manager = await this.connection.manager();
    await manager.query(UPSERT_LISTING, [
      listing.agencyId,
      listing.slug,
      listing.name,
      listing.nameKey,
      listing.description,
      listing.verification,
      [...listing.capabilities],
      JSON.stringify(listing.zones),
      [...listing.siteCities],
      [...listing.cityKeys],
      [...listing.districtKeys],
      listing.publishedAt,
      listing.visible,
      now,
    ]);
  }
}
