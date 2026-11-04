import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { AgencyTeam, Membership } from '../../../domain/agency-team';
import { AgencyTeamRepository } from '../../../domain/ports/agency-team.repository';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { AgencyMembershipOrmEntity } from './agency-membership.orm-entity';
import { AgencyOrmEntity } from './agency.orm-entity';
import { MembershipMapper } from './membership.mapper';

/**
 * Plain SQL on purpose: the `WHERE` of the conflict clause keeps a membership id from being moved to
 * another agency, which TypeORM's upsert cannot express.
 */
const UPSERT = `
  INSERT INTO agency_memberships (id, agency_id, user_id, role, active)
  SELECT changed.id, $1::uuid, changed.user_id, changed.role, changed.active
  FROM unnest($2::uuid[], $3::uuid[], $4::text[], $5::boolean[]) AS changed(id, user_id, role, active)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, active = EXCLUDED.active
  WHERE agency_memberships.agency_id = EXCLUDED.agency_id`;

@Injectable()
export class AgencyTeamTypeOrmRepository implements AgencyTeamRepository {
  /** Memberships as loaded, so that save() writes only the rows the aggregate changed. */
  private readonly loaded = new WeakMap<AgencyTeam, readonly Membership[]>();

  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async load(agencyId: AgencyId): Promise<AgencyTeam> {
    const manager = await this.connection.manager();
    return this.teamOf(agencyId, await manager.find(AgencyMembershipOrmEntity, { where: { agencyId: agencyId.value } }));
  }

  async lockAndLoad(agencyId: AgencyId): Promise<AgencyTeam> {
    const manager = await this.connection.manager();
    await manager.findOne(AgencyOrmEntity, { where: { id: agencyId.value }, lock: { mode: 'pessimistic_write' } });
    return this.teamOf(agencyId, await manager.find(AgencyMembershipOrmEntity, { where: { agencyId: agencyId.value } }));
  }

  private teamOf(agencyId: AgencyId, rows: readonly AgencyMembershipOrmEntity[]): AgencyTeam {
    const team = AgencyTeam.reconstitute(agencyId, rows.map(MembershipMapper.toDomain));
    this.loaded.set(team, team.snapshot());
    return team;
  }

  async save(team: AgencyTeam): Promise<void> {
    const before = new Map((this.loaded.get(team) ?? []).map(membership => [membership.id.value, membership]));
    const changed = team.snapshot().filter(membership => {
      const previous = before.get(membership.id.value);
      return !previous || previous.role !== membership.role || previous.active !== membership.active;
    });
    if (changed.length > 0) {
      const manager = await this.connection.manager();
      await manager.query(UPSERT, [
        team.agencyId.value,
        changed.map(membership => membership.id.value),
        changed.map(membership => membership.userId.value),
        changed.map(membership => membership.role),
        changed.map(membership => membership.active),
      ]);
    }
    this.loaded.set(team, team.snapshot());
  }
}
