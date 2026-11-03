import { NewPassword } from '../../domain/vo/new-password';

export const PASSWORD_HASHER = Symbol('PasswordHasher');

export interface PasswordHasher {
  hash(password: NewPassword): Promise<string>;
  /** With a null hash, still spends the verification cost so unknown accounts are not revealed by timing. */
  verify(hash: string | null, candidate: string): Promise<boolean>;
}
