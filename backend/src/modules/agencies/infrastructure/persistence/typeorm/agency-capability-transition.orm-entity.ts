import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

/**
 * Append-only history of the capabilities of an agency. The key `(agency_id, type, sequence)` is also
 * the last guard of the lifecycle: two concurrent transitions of one capability cannot both take the
 * next sequence number. The current state of a capability is its last transition.
 */
@Entity({ name: 'agency_capability_transitions' })
@Check('agency_capability_transitions_type_valid', `"type" IN ('delivery', 'storage')`)
@Check('agency_capability_transitions_kind_valid', `"kind" IN ('activated', 'suspended')`)
@Check('agency_capability_transitions_sequence_positive', `"sequence" > 0`)
@Check('agency_capability_transitions_reason_matches_kind', `("kind" = 'suspended') = ("reason" IS NOT NULL)`)
@Check('agency_capability_transitions_reason_length', `"reason" IS NULL OR char_length("reason") BETWEEN 3 AND 500`)
export class AgencyCapabilityTransitionOrmEntity {
  @PrimaryColumn({ name: 'agency_id', type: 'uuid', primaryKeyConstraintName: 'agency_capability_transitions_pkey' })
  agencyId: string;

  @ManyToOne('AgencyOrmEntity', { nullable: false })
  @JoinColumn({ name: 'agency_id', foreignKeyConstraintName: 'agency_capability_transitions_agency_id_agencies_id_fk' })
  agency?: object;

  @PrimaryColumn({ type: 'text', primaryKeyConstraintName: 'agency_capability_transitions_pkey' })
  type: string;

  @PrimaryColumn({ type: 'integer', primaryKeyConstraintName: 'agency_capability_transitions_pkey' })
  sequence: number;

  @Column({ type: 'text' })
  kind: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @ManyToOne('UserOrmEntity', { nullable: false })
  @JoinColumn({ name: 'actor_id', foreignKeyConstraintName: 'agency_capability_transitions_actor_id_users_id_fk' })
  actor?: object;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;
}
