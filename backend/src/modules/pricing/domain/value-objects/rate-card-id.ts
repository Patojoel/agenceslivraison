import { Identifier } from '@shared/domain/value-objects/identifier';

export class RateCardId extends Identifier {
  private readonly kind = 'RateCardId';

  static of(value: string): RateCardId {
    return new RateCardId(value);
  }
}
