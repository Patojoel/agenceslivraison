import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * One tier of one zone in one version: up to `max_weight_grams`, the parcel costs `price_xaf`. Written with its version,
 * never updated. The composite foreign key `(agency_id, zone_id)` to `service_zones(agency_id, id)` is the database
 * guarantee that a rate card never prices a zone of another agency (the only table of another module this module
 * points at, by constraint and never by query).
 */
@Entity({ name: 'rate_card_lines' })
@Index('rate_card_lines_version_zone_bound_unique', ['rateCardId', 'versionNumber', 'zoneId', 'maxWeightGrams'], { unique: true })
@Check('rate_card_lines_position_range', `"position" BETWEEN 1 AND 20`)
@Check('rate_card_lines_max_weight_range', `"max_weight_grams" BETWEEN 1 AND 1000000`)
@Check('rate_card_lines_price_range', `"price_xaf" BETWEEN 1 AND 10000000`)
export class RateCardLineOrmEntity {
  @PrimaryColumn({ name: 'rate_card_id', type: 'uuid', primaryKeyConstraintName: 'rate_card_lines_pkey' })
  rateCardId: string;

  @PrimaryColumn({ name: 'version_number', type: 'integer', primaryKeyConstraintName: 'rate_card_lines_pkey' })
  versionNumber: number;

  @PrimaryColumn({ name: 'zone_id', type: 'uuid', primaryKeyConstraintName: 'rate_card_lines_pkey' })
  zoneId: string;

  @PrimaryColumn({ type: 'smallint', primaryKeyConstraintName: 'rate_card_lines_pkey' })
  position: number;

  @Column({ name: 'agency_id', type: 'uuid' })
  agencyId: string;

  @ManyToOne('RateCardVersionOrmEntity', { nullable: false })
  @JoinColumn([
    { name: 'agency_id', referencedColumnName: 'agencyId', foreignKeyConstraintName: 'rate_card_lines_agency_version_rate_card_versions_fk' },
    { name: 'rate_card_id', referencedColumnName: 'rateCardId' },
    { name: 'version_number', referencedColumnName: 'number' },
  ])
  version?: object;

  @ManyToOne('ServiceZoneOrmEntity', { nullable: false })
  @JoinColumn([
    { name: 'agency_id', referencedColumnName: 'agencyId', foreignKeyConstraintName: 'rate_card_lines_agency_zone_service_zones_fk' },
    { name: 'zone_id', referencedColumnName: 'id' },
  ])
  zone?: object;

  @Column({ name: 'max_weight_grams', type: 'integer' })
  maxWeightGrams: number;

  @Column({ name: 'price_xaf', type: 'integer' })
  priceXaf: number;
}
