import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

@Entity({ name: 'agency_memberships' })
@Index('agency_memberships_agency_user_unique', ['agencyId', 'userId'], { unique: true })
@Check('agency_memberships_valid_role', `"role" IN ('owner', 'admin', 'agent')`)
export class AgencyMembershipOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'agency_memberships_pkey' })
  id: string;

  @Column({ name: 'agency_id', type: 'uuid' })
  agencyId: string;

  @ManyToOne('AgencyOrmEntity', { nullable: false })
  @JoinColumn({ name: 'agency_id', foreignKeyConstraintName: 'agency_memberships_agency_id_agencies_id_fk' })
  agency?: object;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne('UserOrmEntity', { nullable: false })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'agency_memberships_user_id_users_id_fk' })
  user?: object;

  @Column({ type: 'text' })
  role: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
