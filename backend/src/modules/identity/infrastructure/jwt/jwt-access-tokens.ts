import { readFileSync } from 'node:fs';
import { JsonWebTokenError, sign, verify } from 'jsonwebtoken';
import { ServiceUnavailableError } from '@shared/application/errors/service-unavailable.error';
import { UserId } from '@shared/domain/value-objects/user-id';
import { AccessTokenClaims, AccessTokens, AccessTokenSigner } from '../../application/ports/access-tokens.port';
import { SessionId } from '../../domain/value-objects/session-id';

const ISSUER = 'agenceslivraison';
const AUDIENCE = 'agenceslivraison-api';
const LIFETIME_SECONDS = 900;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Read on every call so a rotated key file is picked up without restart. */
function signingKey(): string {
  const file = process.env.JWT_SECRET_FILE;
  if (file && process.env.JWT_SECRET) throw new ServiceUnavailableError('Set only JWT_SECRET or JWT_SECRET_FILE');
  let key: string | undefined;
  try {
    key = file ? readFileSync(file, 'utf8').trim() : process.env.JWT_SECRET;
  } catch {
    throw new ServiceUnavailableError('JWT_SECRET_FILE is unreadable');
  }
  if (!key || Buffer.byteLength(key, 'utf8') < 32) throw new ServiceUnavailableError('JWT signing key is missing or shorter than 32 bytes');
  return key;
}

export class JwtAccessTokens implements AccessTokens {
  signer(): AccessTokenSigner {
    const key = signingKey();
    return {
      sign: (userId: UserId, sessionId: SessionId) => ({
        token: sign({ sid: sessionId.value }, key, { algorithm: 'HS256', subject: userId.value, expiresIn: LIFETIME_SECONDS, issuer: ISSUER, audience: AUDIENCE }),
        expiresIn: LIFETIME_SECONDS,
      }),
    };
  }

  verify(token: string): AccessTokenClaims | null {
    const key = signingKey();
    let claims;
    try {
      claims = verify(token, key, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE });
    } catch (error) {
      if (error instanceof JsonWebTokenError) return null;
      throw error;
    }
    if (typeof claims === 'string' || typeof claims.exp !== 'number' || typeof claims.iat !== 'number') return null;
    if (claims.exp <= claims.iat || claims.exp - claims.iat > LIFETIME_SECONDS) return null;
    if (typeof claims.sub !== 'string' || !UUID_V4.test(claims.sub) || typeof claims.sid !== 'string' || !UUID_V4.test(claims.sid)) return null;
    return { userId: claims.sub, sessionId: claims.sid };
  }
}
