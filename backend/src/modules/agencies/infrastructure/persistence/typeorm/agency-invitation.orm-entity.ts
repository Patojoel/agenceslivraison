import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

@Entity({ name: 'agency_invitations' })
@Index('agency_invitations_token_unique', ['tokenDigest'], { unique: true })
@Check('agency_invitations_role', `"role" IN ('admin', 'agent')`)
@Check('agency_invitations_digest', `"token_digest" ~ '^[a-f0-9]{64}$'`)
export class AgencyInvitationOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'agency_invitations_pkey' })
  id: string;

  @Column({ name: 'agency_id', type: 'uuid' })
  agencyId: string;

  @ManyToOne('AgencyOrmEntity', { nullable: false })
  @JoinColumn({ name: 'agency_id', foreignKeyConstraintName: 'agency_invitations_agency_id_agencies_id_fk' })
  agency?: object;

  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'text' })
  role: string;

  @Column({ name: 'token_digest', type: 'text' })
  tokenDigest: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @ManyToOne('UserOrmEntity', { nullable: false })
  @JoinColumn({ name: 'created_by', foreignKeyConstraintName: 'agency_invitations_created_by_users_id_fk' })
  creator?: object;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;
}
