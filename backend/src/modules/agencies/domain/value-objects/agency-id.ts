import { Identifier } from '@shared/domain/value-objects/identifier';

export class AgencyId extends Identifier {
  private readonly kind = 'AgencyId';

  static of(value: string): AgencyId {
    return new AgencyId(value);
  }
}
