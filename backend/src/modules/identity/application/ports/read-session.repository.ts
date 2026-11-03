import { AuthenticatedUser } from '../read-models/authenticated-user.read-model';

export interface OpenSessionCriteria {
  readonly sessionId: string;
  readonly userId: string;
  readonly now: Date;
}

/** Read side of sessions: no aggregate, no invariant, only the projection the guard needs. */
export interface ReadSessionRepository {
  /** The session's user when the session is neither revoked nor expired at `now`, null otherwise. */
  findOpenSessionUser(criteria: OpenSessionCriteria): Promise<AuthenticatedUser | null>;
}

export const READ_SESSION_REPOSITORY = Symbol('ReadSessionRepository');
