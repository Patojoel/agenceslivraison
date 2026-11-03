import { DomainException } from '../domain-exception';

export class InvalidTokenDigest extends DomainException {
  constructor() { super('invalid', 'Invalid token digest'); }
}

export class TokenDigest {
  private constructor(readonly value: string) {}

  static of(value: string): TokenDigest {
    if (!/^[a-f0-9]{64}$/.test(value)) throw new InvalidTokenDigest();
    return new TokenDigest(value);
  }

  // Constant-time on purpose: an early exit would leak how many characters match.
  matches(other: TokenDigest): boolean {
    let difference = 0;
    for (let index = 0; index < this.value.length; index++) difference |= this.value.charCodeAt(index) ^ other.value.charCodeAt(index);
    return difference === 0;
  }
}
