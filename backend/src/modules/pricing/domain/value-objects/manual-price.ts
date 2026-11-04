import { InvalidPricingField } from '../exceptions/pricing.exceptions';
import { characterCount, isPlainLine } from './plain-text';
import { Price } from './price';

export const MANUAL_REASON_MIN = 3;
export const MANUAL_REASON_MAX = 300;

/** A price a member retains instead of (or for lack of) the calculated one, always with the reason for it. */
export class ManualPrice {
  private constructor(readonly price: number, readonly reason: string) {}

  static of(price: number, rawReason: string): ManualPrice {
    const retained = Price.of(price).value;
    const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
    const length = characterCount(reason);
    if (!isPlainLine(reason) || length < MANUAL_REASON_MIN || length > MANUAL_REASON_MAX) throw new InvalidPricingField('manualPriceReason');
    return new ManualPrice(retained, reason);
  }
}
