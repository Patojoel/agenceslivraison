import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

@Entity({ name: 'sessions' })
@Index('sessions_token_digest_unique', ['tokenDigest'], { unique: true })
@Check('sessions_digest_format', `"token_digest" ~ '^[a-f0-9]{64}$'`)
@Check('sessions_version_positive', `"version" > 0`)
export class SessionOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'sessions_pkey' })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne('UserOrmEntity', { nullable: false })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'sessions_user_id_users_id_fk' })
  user?: object;

  @Column({ name: 'token_digest', type: 'text' })
  tokenDigest: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'integer', default: 1 })
  version: number;
}
