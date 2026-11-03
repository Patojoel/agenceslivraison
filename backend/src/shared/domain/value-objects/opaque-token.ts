import { DomainException } from '../exceptions/domain.exception';

const FORMAT = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

export class InvalidOpaqueToken extends DomainException {
  constructor() { super('invalid', 'Invalid token'); }
}

/** `<record id>.<secret>`: the id locates the record, only the secret's digest is stored. */
export class OpaqueToken {
  private constructor(readonly id: string, readonly secret: string) {}

  static parse(raw: string): OpaqueToken {
    const [, id, secret] = FORMAT.exec(raw) ?? [];
    if (!id || !secret) throw new InvalidOpaqueToken();
    return new OpaqueToken(id, secret);
  }

  static compose(id: string, secret: string): OpaqueToken {
    return OpaqueToken.parse(`${id}.${secret}`);
  }

  toString(): string {
    return `${this.id}.${this.secret}`;
  }
}
