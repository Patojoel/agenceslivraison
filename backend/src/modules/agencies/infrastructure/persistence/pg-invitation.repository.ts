import { Database } from '../../../../shared/infrastructure/db/database';
import { Email } from '../../../../shared/domain/vo/email';
import { TokenDigest } from '../../../../shared/domain/vo/token-digest';
import { UserId } from '../../../../shared/domain/vo/user-id';
import { InvitationRole } from '../../domain/agency-role';
import { Invitation } from '../../domain/model/invitation';
import { InvitationRepository } from '../../domain/repositories/invitation.repository';
import { AgencyId } from '../../domain/vo/agency-id';
import { InvitationId } from '../../domain/vo/invitation-id';

type InvitationRow = {
  id: string; agency_id: string; email: string; role: InvitationRole; token_digest: string;
  created_by: string; expires_at: Date; accepted_at: Date | null;
};

export class PgInvitationRepository implements InvitationRepository {
  constructor(private readonly database: Database) {}

  async add(invitation: Invitation): Promise<void> {
    const state = invitation.snapshot();
    await this.database.execute(
      'INSERT INTO agency_invitations (id, agency_id, email, role, token_digest, created_by, expires_at, accepted_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [state.id.value, state.agencyId.value, state.email.value, state.role, state.tokenDigest.value, state.createdBy.value, state.expiresAt, state.acceptedAt],
    );
  }

  async findForUpdate(id: InvitationId): Promise<Invitation | null> {
    const [row] = await this.database.query<InvitationRow>(
      'SELECT id, agency_id, email, role, token_digest, created_by, expires_at, accepted_at FROM agency_invitations WHERE id = $1 FOR UPDATE', [id.value],
    );
    if (!row) return null;
    return Invitation.reconstitute({
      id: InvitationId.of(row.id), agencyId: AgencyId.of(row.agency_id), email: Email.of(row.email), role: row.role,
      tokenDigest: TokenDigest.of(row.token_digest), createdBy: UserId.of(row.created_by), expiresAt: row.expires_at, acceptedAt: row.accepted_at,
    });
  }

  async save(invitation: Invitation): Promise<void> {
    const state = invitation.snapshot();
    await this.database.execute('UPDATE agency_invitations SET accepted_at = $1 WHERE id = $2', [state.acceptedAt, state.id.value]);
  }
}
