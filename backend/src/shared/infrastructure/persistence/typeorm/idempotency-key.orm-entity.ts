import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

@Entity({ name: 'idempotency_keys' })
@Check('idempotency_keys_key_length', `char_length("key") BETWEEN 8 AND 128`)
@Check('idempotency_keys_request_hash_format', `"request_hash" ~ '^[a-f0-9]{64}$'`)
export class IdempotencyKeyOrmEntity {
  @PrimaryColumn({ name: 'actor_id', type: 'uuid', primaryKeyConstraintName: 'idempotency_keys_pkey' })
  actorId: string;

  @ManyToOne('UserOrmEntity', { nullable: false })
  @JoinColumn({ name: 'actor_id', foreignKeyConstraintName: 'idempotency_keys_actor_id_users_id_fk' })
  actor?: object;

  @PrimaryColumn({ type: 'text', primaryKeyConstraintName: 'idempotency_keys_pkey' })
  scope: string;

  @PrimaryColumn({ type: 'text', primaryKeyConstraintName: 'idempotency_keys_pkey' })
  key: string;

  @Column({ name: 'request_hash', type: 'text' })
  requestHash: string;

  @Column({ name: 'resource_id', type: 'uuid' })
  resourceId: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
