import { InvitationRole } from '../../../domain/agency-role';

export interface IssueInvitationCommand {
  readonly actorId: string;
  readonly agencyId: string;
  readonly email: string;
  readonly role: InvitationRole;
}
