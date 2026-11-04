import { Identifier } from '@shared/domain/value-objects/identifier';

export class QuoteId extends Identifier {
  private readonly kind = 'QuoteId';

  static of(value: string): QuoteId {
    return new QuoteId(value);
  }
}
