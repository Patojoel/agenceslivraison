import { InvalidPricingField } from '../exceptions/pricing.exceptions';

export const MAX_QUOTE_NUMBER = 999_999;
const FORMAT = /^DEV-(\d{4})-(\d{6})$/;

/** The readable reference of a quote, `DEV-<year>-<number on six digits>`, unique and increasing inside an agency. */
export class QuoteReference {
  private constructor(readonly year: number, readonly number: number) {}

  static of(year: number, number: number): QuoteReference {
    if (!Number.isInteger(year) || year < 2000 || year > 9999 || !Number.isInteger(number) || number < 1 || number > MAX_QUOTE_NUMBER) throw new InvalidPricingField('reference');
    return new QuoteReference(year, number);
  }

  /** A reference read back from storage. */
  static parse(value: string): QuoteReference {
    const match = FORMAT.exec(value);
    if (!match) throw new InvalidPricingField('reference');
    return QuoteReference.of(Number(match[1]), Number(match[2]));
  }

  get value(): string {
    return `DEV-${this.year}-${String(this.number).padStart(6, '0')}`;
  }
}
