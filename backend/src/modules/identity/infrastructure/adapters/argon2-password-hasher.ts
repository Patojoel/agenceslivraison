import * as argon2 from 'argon2';
import { PasswordHasher } from '../../application/ports/password-hasher';
import { NewPassword } from '../../domain/vo/new-password';

const DECOY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$sDbt/mYsiVrBeP80Np+K5g$PAxLDo8DSXHkzA4CN0JJy5WUpK1BOVUSQxeCrevR2+k';

export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: NewPassword): Promise<string> {
    return argon2.hash(password.value, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  }

  async verify(hash: string | null, candidate: string): Promise<boolean> {
    const valid = await argon2.verify(hash ?? DECOY_HASH, candidate);
    return hash !== null && valid;
  }
}
