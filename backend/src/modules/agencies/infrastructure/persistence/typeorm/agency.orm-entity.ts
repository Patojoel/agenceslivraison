import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

@Entity({ name: 'agencies' })
@Check('agencies_status_valid', `"status" IN ('draft', 'submitted')`)
@Check('agencies_trade_name_length', `char_length("trade_name") BETWEEN 2 AND 120`)
@Check('agencies_version_positive', `"version" > 0`)
@Check('agencies_submission_recorded', `"status" <> 'submitted' OR ("submitted_at" IS NOT NULL AND "submitted_by" IS NOT NULL)`)
@Check('agencies_description_length', `"description" IS NULL OR char_length("description") BETWEEN 1 AND 1000`)
@Check('agencies_legal_name_length', `"legal_name" IS NULL OR char_length("legal_name") BETWEEN 2 AND 200`)
@Check('agencies_headquarters_city_length', `"headquarters_city" IS NULL OR char_length("headquarters_city") BETWEEN 2 AND 80`)
@Check('agencies_headquarters_address_length', `"headquarters_address" IS NULL OR char_length("headquarters_address") BETWEEN 5 AND 300`)
@Check('agencies_primary_phone_format', `"primary_phone" IS NULL OR "primary_phone" ~ '^\\+237[26][0-9]{8}$'`)
@Check('agencies_contact_email_length', `"contact_email" IS NULL OR char_length("contact_email") BETWEEN 3 AND 254`)
@Check('agencies_rccm_length', `"rccm" IS NULL OR char_length("rccm") BETWEEN 5 AND 40`)
@Check('agencies_niu_format', `"niu" IS NULL OR "niu" ~ '^[A-Za-z0-9]{14}$'`)
export class AgencyOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'agencies_pkey' })
  id: string;

  @Column({ name: 'trade_name', type: 'text' })
  tradeName: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', default: 'draft' })
  status: string;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @ManyToOne('UserOrmEntity', { nullable: false })
  @JoinColumn({ name: 'created_by', foreignKeyConstraintName: 'agencies_created_by_users_id_fk' })
  creator?: object;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'legal_name', type: 'text', nullable: true })
  legalName: string | null;

  @Column({ name: 'headquarters_city', type: 'text', nullable: true })
  headquartersCity: string | null;

  @Column({ name: 'headquarters_address', type: 'text', nullable: true })
  headquartersAddress: string | null;

  @Column({ name: 'primary_phone', type: 'text', nullable: true })
  primaryPhone: string | null;

  @Column({ name: 'contact_email', type: 'text', nullable: true })
  contactEmail: string | null;

  @Column({ type: 'text', nullable: true })
  rccm: string | null;

  @Column({ type: 'text', nullable: true })
  niu: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'submitted_by', type: 'uuid', nullable: true })
  submittedBy: string | null;

  @ManyToOne('UserOrmEntity', { nullable: true })
  @JoinColumn({ name: 'submitted_by', foreignKeyConstraintName: 'agencies_submitted_by_users_id_fk' })
  submitter?: object;
}
