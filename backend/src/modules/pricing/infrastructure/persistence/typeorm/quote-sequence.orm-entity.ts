import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * The last number given to a quote of an agency in a year. Taking the next one is one `INSERT ... ON CONFLICT DO UPDATE`
 * that locks the row until the transaction ends: two emissions at once are served one after the other, numbers never
 * repeat and, a refused emission rolling its increment back, never skip.
 */
@Entity({ name: 'quote_sequences' })
@Check('quote_sequences_year_range', `"year" BETWEEN 2000 AND 9999`)
@Check('quote_sequences_last_number_range', `"last_number" BETWEEN 1 AND 999999`)
export class QuoteSequenceOrmEntity {
  @PrimaryColumn({ name: 'agency_id', type: 'uuid', primaryKeyConstraintName: 'quote_sequences_pkey' })
  agencyId: string;

  @ManyToOne('AgencyOrmEntity', { nullable: false })
  @JoinColumn({ name: 'agency_id', foreignKeyConstraintName: 'quote_sequences_agency_id_agencies_id_fk' })
  agency?: object;

  @PrimaryColumn({ type: 'integer', primaryKeyConstraintName: 'quote_sequences_pkey' })
  year: number;

  @Column({ name: 'last_number', type: 'integer' })
  lastNumber: number;
}
