/** Accounts created without credentials have no email and no account type. */
export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string | null;
  readonly accountType: string | null;
}
