import { TokenDigest } from '../../domain/vo/token-digest';

export const TOKEN_SECRETS = Symbol('TokenSecrets');

export interface TokenSecrets {
  /** Returns a 43-character base64url secret. */
  generate(): string;
  digest(secret: string): TokenDigest;
}
