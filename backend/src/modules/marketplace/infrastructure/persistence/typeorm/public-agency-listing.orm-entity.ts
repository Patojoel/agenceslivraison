import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * The projection the directory reads: one row per agency that has a profile, rewritten whole by the subscriber of the
 * module whenever something it shows changes. Only the fields of the closed list of D-23 (see `PublicListing`): no legal
 * name, phone, e-mail, registration number, address or member. `agency_id` is the key and never leaves the module. The
 * index serves the alphabetical order of the visible rows (name, then slug); no other index is kept: the measures of B3.13 (docs/routes/marketplace.md) show none is worth its cost at the expected volume.
 */
@Entity({ name: 'public_agency_listings' })
@Index('public_agency_listings_slug_unique', ['slug'], { unique: true })
@Index('public_agency_listings_visible_name_idx', ['nameKey', 'slug'], { where: '"visible"' })
@Check('public_agency_listings_name_length', `char_length("name") BETWEEN 2 AND 120`)
@Check('public_agency_listings_description_length', `"description" IS NULL OR char_length("description") BETWEEN 1 AND 1000`)
@Check('public_agency_listings_verification_values', `"verification" = 'unverified'`)
@Check('public_agency_listings_capabilities_known', `"capabilities" <@ ARRAY['delivery', 'storage']::text[]`)
@Check('public_agency_listings_zones_array', `jsonb_typeof("zones") = 'array'`)
@Check('public_agency_listings_visible_needs_capability', `NOT "visible" OR cardinality("capabilities") > 0`)
export class PublicAgencyListingOrmEntity {
  @PrimaryColumn({ name: 'agency_id', type: 'uuid', primaryKeyConstraintName: 'public_agency_listings_pkey' })
  agencyId: string;

  @ManyToOne('AgencyPublicProfileOrmEntity', { nullable: false })
  @JoinColumn({ name: 'agency_id', foreignKeyConstraintName: 'public_agency_listings_agency_id_agency_public_profiles_fk' })
  profile?: object;

  @Column({ type: 'text' })
  slug: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'name_key', type: 'text' })
  nameKey: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text' })
  verification: string;

  @Column({ type: 'text', array: true })
  capabilities: string[];

  /** `[{ id, city, district, startingPrice }]`, active zones only. */
  @Column({ type: 'jsonb' })
  zones: object;

  @Column({ name: 'site_cities', type: 'text', array: true })
  siteCities: string[];

  /** Search keys (comparison form of the cities of the active zones and sites); never shown. */
  @Column({ name: 'city_keys', type: 'text', array: true })
  cityKeys: string[];

  /** Search keys (city and district of the active zones, empty district for a whole city); never shown. */
  @Column({ name: 'district_keys', type: 'text', array: true })
  districtKeys: string[];

  @Column({ name: 'published_at', type: 'timestamptz' })
  publishedAt: Date;

  @Column({ type: 'boolean' })
  visible: boolean;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
