import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * The zones an agency serves. The identifier is meant to be shared: rate cards (B3) will point at it,
 * through `(agency_id, id)` so that a card can never name a zone of another agency.
 * `city_key` and `district_key` are the comparison forms (no case, accents or repeated spaces) computed
 * by the domain; `district_key` is empty when the zone covers the whole city.
 */
@Entity({ name: 'service_zones' })
@Index('service_zones_agency_id_id_unique', ['agencyId', 'id'], { unique: true })
@Index('service_zones_active_area_unique', ['agencyId', 'cityKey', 'districtKey'], { unique: true, where: '"retired_at" IS NULL' })
@Index('service_zones_agency_area_idx', ['agencyId', 'cityKey', 'districtKey', 'id'])
@Check('service_zones_city_length', `char_length("city") BETWEEN 2 AND 80`)
@Check('service_zones_district_length', `"district" IS NULL OR char_length("district") BETWEEN 2 AND 80`)
@Check('service_zones_keys_match', `("district" IS NULL) = ("district_key" = '')`)
@Check('service_zones_retired_after_added', `"retired_at" IS NULL OR "retired_at" >= "added_at"`)
export class ServiceZoneOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'service_zones_pkey' })
  id: string;

  @Column({ name: 'agency_id', type: 'uuid' })
  agencyId: string;

  @ManyToOne('AgencyOrmEntity', { nullable: false })
  @JoinColumn({ name: 'agency_id', foreignKeyConstraintName: 'service_zones_agency_id_agencies_id_fk' })
  agency?: object;

  @Column({ type: 'text' })
  city: string;

  @Column({ type: 'text', nullable: true })
  district: string | null;

  @Column({ name: 'city_key', type: 'text' })
  cityKey: string;

  @Column({ name: 'district_key', type: 'text' })
  districtKey: string;

  @Column({ name: 'added_at', type: 'timestamptz' })
  addedAt: Date;

  @Column({ name: 'retired_at', type: 'timestamptz', nullable: true })
  retiredAt: Date | null;
}
