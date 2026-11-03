import { UserId } from '../../../../shared/domain/vo/user-id';
import { SessionId } from '../../domain/vo/session-id';

export const ACCESS_TOKENS = Symbol('AccessTokens');

export interface IssuedAccessToken {
  readonly token: string;
  readonly expiresIn: number;
}

export interface AccessTokenSigner {
  sign(userId: UserId, sessionId: SessionId): IssuedAccessToken;
}

export interface AccessTokenClaims {
  readonly userId: string;
  readonly sessionId: string;
}

export interface AccessTokens {
  /** @throws ServiceUnavailableError when no signing key is configured */
  signer(): AccessTokenSigner;
  /** Returns null for an invalid token. @throws ServiceUnavailableError when no signing key is configured */
  verify(token: string): AccessTokenClaims | null;
}
