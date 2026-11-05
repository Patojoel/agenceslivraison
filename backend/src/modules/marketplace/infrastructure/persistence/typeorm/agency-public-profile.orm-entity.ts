import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * Whether an agency shows itself on the marketplace, and under which address. One row per agency that ever published,
 * never deleted: a withdrawal only marks the row, so the unique slug stays reserved and is never given to another agency.
 * `published` is the reverse of `unpublished_at` being empty, which the check keeps true.
 */
@Entity({ name: 'agency_public_profiles' })
@Index('agency_public_profiles_slug_unique', ['slug'], { unique: true })
@Check('agency_public_profiles_slug_shape', `"slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("slug") BETWEEN 3 AND 80`)
@Check('agency_public_profiles_published_matches_withdrawal', `"published" = ("unpublished_at" IS NULL)`)
@Check('agency_public_profiles_withdrawn_after_published', `"unpublished_at" IS NULL OR "unpublished_at" >= "published_at"`)
export class AgencyPublicProfileOrmEntity {
  @PrimaryColumn({ name: 'agency_id', type: 'uuid', primaryKeyConstraintName: 'agency_public_profiles_pkey' })
  agencyId: string;

  @ManyToOne('AgencyOrmEntity', { nullable: false })
  @JoinColumn({ name: 'agency_id', foreignKeyConstraintName: 'agency_public_profiles_agency_id_agencies_id_fk' })
  agency?: object;

  @Column({ type: 'text' })
  slug: string;

  @Column({ type: 'boolean' })
  published: boolean;

  @Column({ name: 'published_at', type: 'timestamptz' })
  publishedAt: Date;

  @Column({ name: 'published_by', type: 'uuid' })
  publishedBy: string;

  @ManyToOne('UserOrmEntity', { nullable: false })
  @JoinColumn({ name: 'published_by', foreignKeyConstraintName: 'agency_public_profiles_published_by_users_id_fk' })
  publisher?: object;

  @Column({ name: 'unpublished_at', type: 'timestamptz', nullable: true })
  unpublishedAt: Date | null;
}
