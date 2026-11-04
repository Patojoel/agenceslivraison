/** What the team screen needs: who holds which role. No e-mail, no name: those belong to the identity of the person. */
export interface AgencyMemberReadModel {
  readonly membershipId: string;
  readonly userId: string;
  readonly role: string;
}
