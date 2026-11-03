export interface RevokeMembershipCommand {
  readonly actorId: string;
  readonly agencyId: string;
  readonly membershipId: string;
}
