export interface IssueInvitationResponse {
  /** Returned once, never stored in clear. */
  readonly token: string;
  readonly expiresAt: string;
}
