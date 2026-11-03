import { AuditEntry, AuditLog } from '../../application/ports/audit-log';
import { IdGenerator } from '../../application/ports/id-generator';
import { Database } from '../db/database';

export class PgAuditLog implements AuditLog {
  constructor(private readonly database: Database, private readonly ids: IdGenerator) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.database.execute(
      'INSERT INTO identity_audit (id, user_id, action, agency_id, subject_user_id) VALUES ($1, $2, $3, $4, $5)',
      [this.ids.generate(), entry.userId, entry.action, entry.agencyId ?? null, entry.subjectUserId ?? null],
    );
  }
}
