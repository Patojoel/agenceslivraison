import { InvalidPassword } from '../exceptions/identity.exceptions';

const MIN_LENGTH = 12;
const MAX_LENGTH = 128;
const MAX_BYTES = 256;

export class NewPassword {
  private constructor(readonly value: string) {}

  static of(raw: string): NewPassword {
    if (raw.length < MIN_LENGTH || raw.length > MAX_LENGTH || new TextEncoder().encode(raw).length > MAX_BYTES) throw new InvalidPassword();
    return new NewPassword(raw);
  }
}
