import { Invitation } from '../invitation';
import { InvitationId } from '../value-objects/invitation-id';

export const INVITATION_REPOSITORY = Symbol('InvitationRepository');

export interface InvitationRepository {
  add(invitation: Invitation): Promise<void>;
  /** Holds the invitation until the transaction ends, so it can be accepted only once. */
  findForUpdate(id: InvitationId): Promise<Invitation | null>;
  save(invitation: Invitation): Promise<void>;
}
