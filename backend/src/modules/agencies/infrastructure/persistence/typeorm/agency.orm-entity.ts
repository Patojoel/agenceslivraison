import { Entity, PrimaryColumn } from 'typeorm';

/** Agency onboarding will enrich this identity with its business profile. */
@Entity({ name: 'agencies' })
export class AgencyOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'agencies_pkey' })
  id: string;
}
