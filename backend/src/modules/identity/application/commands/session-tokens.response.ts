/** Returned by login and refresh. */
export interface SessionTokensResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}
