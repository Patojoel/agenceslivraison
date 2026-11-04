import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/** `name_key` is the comparison form of the name (no case, accents or repeated spaces) computed by the domain. */
@Entity({ name: 'agency_sites' })
@Index('agency_sites_active_name_unique', ['agencyId', 'nameKey'], { unique: true, where: '"deactivated_at" IS NULL' })
@Index('agency_sites_agency_name_idx', ['agencyId', 'nameKey', 'id'])
@Check('agency_sites_name_length', `char_length("name") BETWEEN 2 AND 120`)
@Check('agency_sites_city_length', `char_length("city") BETWEEN 2 AND 80`)
@Check('agency_sites_address_length', `char_length("address") BETWEEN 5 AND 300`)
@Check('agency_sites_phone_format', `"phone" IS NULL OR "phone" ~ '^\\+237[26][0-9]{8}$'`)
@Check('agency_sites_version_positive', `"version" > 0`)
@Check('agency_sites_deactivated_after_created', `"deactivated_at" IS NULL OR "deactivated_at" >= "created_at"`)
export class AgencySiteOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'agency_sites_pkey' })
  id: string;

  @Column({ name: 'agency_id', type: 'uuid' })
  agencyId: string;

  @ManyToOne('AgencyOrmEntity', { nullable: false })
  @JoinColumn({ name: 'agency_id', foreignKeyConstraintName: 'agency_sites_agency_id_agencies_id_fk' })
  agency?: object;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'name_key', type: 'text' })
  nameKey: string;

  @Column({ type: 'text' })
  city: string;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivatedAt: Date | null;

  @Column({ type: 'integer', default: 1 })
  version: number;
}
