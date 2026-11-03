import { AgencyRole } from '../../../domain/agency-role';

export interface ChangeMemberRoleCommand {
  readonly actorId: string;
  readonly agencyId: string;
  readonly membershipId: string;
  readonly role: AgencyRole;
}
