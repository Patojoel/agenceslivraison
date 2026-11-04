import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * The delivery rate card of an agency: one row per agency, which only says which version is in force.
 * `(agency_id, id)` is unique so that versions and lines can carry the agency and be tied to it by foreign key.
 */
@Entity({ name: 'rate_cards' })
@Index('rate_cards_agency_id_unique', ['agencyId'], { unique: true })
@Index('rate_cards_agency_id_id_unique', ['agencyId', 'id'], { unique: true })
@Check('rate_cards_current_version_positive', `"current_version" > 0`)
export class RateCardOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'rate_cards_pkey' })
  id: string;

  @Column({ name: 'agency_id', type: 'uuid' })
  agencyId: string;

  @ManyToOne('AgencyOrmEntity', { nullable: false })
  @JoinColumn({ name: 'agency_id', foreignKeyConstraintName: 'rate_cards_agency_id_agencies_id_fk' })
  agency?: object;

  @Column({ name: 'current_version', type: 'integer' })
  currentVersion: number;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
