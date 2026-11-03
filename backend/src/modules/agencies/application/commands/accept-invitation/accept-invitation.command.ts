export interface AcceptInvitationCommand {
  readonly userId: string;
  readonly email: string | null;
  readonly token: string;
}
