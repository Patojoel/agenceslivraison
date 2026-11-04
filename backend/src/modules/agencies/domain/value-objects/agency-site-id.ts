import { Identifier } from '@shared/domain/value-objects/identifier';

export class AgencySiteId extends Identifier {
  private readonly kind = 'AgencySiteId';

  static of(value: string): AgencySiteId {
    return new AgencySiteId(value);
  }
}
