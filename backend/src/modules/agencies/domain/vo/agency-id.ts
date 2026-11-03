import { Identifier } from '../../../../shared/domain/vo/identifier';

export class AgencyId extends Identifier {
  private readonly kind = 'AgencyId';

  static of(value: string): AgencyId {
    return new AgencyId(value);
  }
}
