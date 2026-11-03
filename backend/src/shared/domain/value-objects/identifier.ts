import { DomainException } from '../exceptions/domain.exception';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class InvalidIdentifier extends DomainException {
  constructor() { super('invalid', 'Invalid identifier'); }
}

export abstract class Identifier {
  protected constructor(readonly value: string) {
    if (!UUID.test(value)) throw new InvalidIdentifier();
  }

  equals(other: this): boolean {
    return this.value === other.value;
  }
}
