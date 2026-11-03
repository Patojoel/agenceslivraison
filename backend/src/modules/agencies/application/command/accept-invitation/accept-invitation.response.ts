import { InvitationRole } from '../../../domain/agency-role';

export interface AcceptInvitationResponse {
  readonly agencyId: string;
  readonly role: InvitationRole;
}
