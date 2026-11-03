import { Session } from '../session';
import { SessionId } from '../value-objects/session-id';

export const SESSION_REPOSITORY = Symbol('SessionRepository');

export interface SessionRepository {
  add(session: Session): Promise<void>;
  /** Holds the session until the transaction ends, so concurrent refreshes are serialized. */
  findForUpdate(id: SessionId): Promise<Session | null>;
  save(session: Session): Promise<void>;
}
