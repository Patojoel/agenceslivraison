export const AUDIT_LOG = Symbol('AuditLog');

/** Safe metadata only: names of things, never the values a person typed. */
export interface AuditDetails {
  readonly fields: readonly string[];
}

export interface AuditEntry {
  readonly userId: string;
  readonly action: string;
  readonly agencyId?: string;
  readonly subjectUserId?: string;
  /** Opaque identifier of the resource the action touched (a zone, a site…); never a value a person typed. */
  readonly resourceId?: string;
  readonly details?: AuditDetails;
}

export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}
