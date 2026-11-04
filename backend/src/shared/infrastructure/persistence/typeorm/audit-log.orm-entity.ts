import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

@Entity({ name: 'identity_audit' })
export class AuditLogOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'identity_audit_pkey' })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne('UserOrmEntity', { nullable: false })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'identity_audit_user_id_users_id_fk' })
  user?: object;

  @Column({ type: 'text' })
  action: string;

  @Column({ name: 'agency_id', type: 'uuid', nullable: true })
  agencyId: string | null;

  @Column({ name: 'subject_user_id', type: 'uuid', nullable: true })
  subjectUserId: string | null;

  /** Safe metadata about the action, such as the names of the fields a person changed; never their values. */
  @Column({ type: 'jsonb', nullable: true })
  details: { fields: string[] } | null;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'now()' })
  occurredAt: Date;
}
