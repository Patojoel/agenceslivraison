import { Database } from '../../../../shared/infrastructure/db/database';
import { UserId } from '../../../../shared/domain/vo/user-id';
import { AgencyRole } from '../../domain/agency-role';
import { AgencyTeam, Membership } from '../../domain/model/agency-team';
import { AgencyTeamRepository } from '../../domain/repositories/agency-team.repository';
import { AgencyId } from '../../domain/vo/agency-id';
import { MembershipId } from '../../domain/vo/membership-id';

type MembershipRow = { id: string; user_id: string; role: AgencyRole; active: boolean };

const UPSERT = `
  INSERT INTO agency_memberships (id, agency_id, user_id, role, active)
  SELECT changed.id, $1::uuid, changed.user_id, changed.role, changed.active
  FROM unnest($2::uuid[], $3::uuid[], $4::text[], $5::boolean[]) AS changed(id, user_id, role, active)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, active = EXCLUDED.active
  WHERE agency_memberships.agency_id = EXCLUDED.agency_id`;

export class PgAgencyTeamRepository implements AgencyTeamRepository {
  /** Memberships as loaded, so that save() writes only the rows the aggregate changed. */
  private readonly loaded = new WeakMap<AgencyTeam, readonly Membership[]>();

  constructor(private readonly database: Database) {}

  async lockAndLoad(agencyId: AgencyId): Promise<AgencyTeam> {
    await this.database.execute('SELECT id FROM agencies WHERE id = $1 FOR UPDATE', [agencyId.value]);
    const rows = await this.database.query<MembershipRow>('SELECT id, user_id, role, active FROM agency_memberships WHERE agency_id = $1', [agencyId.value]);
    const team = AgencyTeam.reconstitute(agencyId, rows.map(row => ({ id: MembershipId.of(row.id), userId: UserId.of(row.user_id), role: row.role, active: row.active })));
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
      await this.database.execute(UPSERT, [
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
