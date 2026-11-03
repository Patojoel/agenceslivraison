export const AUDIT_LOG = Symbol('AuditLog');

export interface AuditEntry {
  readonly userId: string;
  readonly action: string;
  readonly agencyId?: string;
  readonly subjectUserId?: string;
}

export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}
