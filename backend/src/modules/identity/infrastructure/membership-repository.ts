import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AgencyRole, canManageMembership } from '../domain/agency-policy';

export class MembershipNotFound extends Error {}
export class MembershipForbidden extends Error {}
export class LastOwner extends Error {}
type Row = { id: string; user_id: string; role: AgencyRole; active: boolean };

/** All owner mutations for one agency must take the same agency row lock. */
export class MembershipRepository {
  constructor(private readonly pool: Pool) {}
  async remove(actorId: string, agencyId: string, targetId: string): Promise<void> {
    return this.change(actorId, agencyId, targetId, undefined, false);
  }
  async change(actorId: string, agencyId: string, targetId: string, role: AgencyRole | undefined, active: boolean): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Membership is checked under this lock, so concurrent removals cannot bypass it.
      await client.query('SELECT id FROM agencies WHERE id = $1 FOR UPDATE', [agencyId]);
      const actor = await client.query<Row>('SELECT id, user_id, role, active FROM agency_memberships WHERE agency_id = $1 AND user_id = $2 AND active = true', [agencyId, actorId]);
      if (!actor.rows[0]) throw new MembershipNotFound();
      const target = await client.query<Row>('SELECT id, user_id, role, active FROM agency_memberships WHERE agency_id = $1 AND id = $2 AND active = true', [agencyId, targetId]);
      const existing = target.rows[0];
      if (!existing) throw new MembershipNotFound();
      const nextRole = role ?? existing.role;
      if (!canManageMembership(actor.rows[0].role, existing.role, nextRole, actorId === existing.user_id)) throw new MembershipForbidden();
      if (existing.role === 'owner' && (!active || nextRole !== 'owner')) {
        const count = await client.query<{ count: string }>("SELECT count(*) AS count FROM agency_memberships WHERE agency_id = $1 AND role = 'owner' AND active = true", [agencyId]);
        if (Number(count.rows[0].count) <= 1) throw new LastOwner();
      }
      await client.query('UPDATE agency_memberships SET role = $1, active = $2 WHERE id = $3 AND agency_id = $4', [nextRole, active, targetId, agencyId]);
      await client.query('INSERT INTO identity_audit (id, user_id, action, agency_id, subject_user_id) VALUES ($1, $2, $3, $4, $5)', [randomUUID(), actorId, active ? 'membership.role_changed' : 'membership.removed', agencyId, existing.user_id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
