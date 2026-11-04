import { InvalidPricingField } from '../exceptions/pricing.exceptions';

export const MIN_PRICE = 1;
export const MAX_PRICE = 10_000_000;

/** A price in CFA francs (XAF): a whole number, taxes included. There is no other currency and no decimals. */
export class Price {
  private constructor(readonly value: number) {}

  static of(value: number): Price {
    if (!Number.isSafeInteger(value) || value < MIN_PRICE || value > MAX_PRICE) throw new InvalidPricingField('price');
    return new Price(value);
  }
}
