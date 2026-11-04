import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * Versions are written once and never updated: the repository has no method that does it. The agency is carried by the
 * row and tied to the rate card by a composite foreign key, so a version cannot sit under another agency.
 */
@Entity({ name: 'rate_card_versions' })
@Index('rate_card_versions_agency_card_number_unique', ['agencyId', 'rateCardId', 'number'], { unique: true })
@Check('rate_card_versions_number_positive', `"number" > 0`)
@Check('rate_card_versions_divisor_range', `"volumetric_divisor" IS NULL OR "volumetric_divisor" BETWEEN 1000 AND 10000`)
export class RateCardVersionOrmEntity {
  @PrimaryColumn({ name: 'rate_card_id', type: 'uuid', primaryKeyConstraintName: 'rate_card_versions_pkey' })
  rateCardId: string;

  @PrimaryColumn({ type: 'integer', primaryKeyConstraintName: 'rate_card_versions_pkey' })
  number: number;

  @Column({ name: 'agency_id', type: 'uuid' })
  agencyId: string;

  @ManyToOne('RateCardOrmEntity', { nullable: false })
  @JoinColumn([
    { name: 'agency_id', referencedColumnName: 'agencyId', foreignKeyConstraintName: 'rate_card_versions_agency_rate_card_rate_cards_fk' },
    { name: 'rate_card_id', referencedColumnName: 'id' },
  ])
  rateCard?: object;

  @Column({ name: 'volumetric_divisor', type: 'integer', nullable: true })
  volumetricDivisor: number | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @ManyToOne('UserOrmEntity', { nullable: false })
  @JoinColumn({ name: 'created_by', foreignKeyConstraintName: 'rate_card_versions_created_by_users_id_fk' })
  author?: object;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
