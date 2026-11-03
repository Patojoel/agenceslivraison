import { createHash, randomBytes } from 'node:crypto';
import { TokenSecrets } from '../../application/ports/token-secrets.port';
import { TokenDigest } from '../../domain/value-objects/token-digest';

export class Sha256TokenSecrets implements TokenSecrets {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }

  digest(secret: string): TokenDigest {
    return TokenDigest.of(createHash('sha256').update(secret).digest('hex'));
  }
}
