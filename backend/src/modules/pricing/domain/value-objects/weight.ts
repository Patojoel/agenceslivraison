import { InvalidPricingField } from '../exceptions/pricing.exceptions';

export const MAX_WEIGHT_GRAMS = 1_000_000;
const MAX_TEXT_LENGTH = 32;
const WEIGHT = /^\s*(\d{1,7})(?:[.,](\d{1,12}))?\s*(kg|g)\s*$/;

/** A weight in whole grams, from 1 g to 1 000 kg, always written with its unit (`kg` or `g`). */
export class Weight {
  private constructor(readonly grams: number) {}

  /** A bound of the scale: exact to the gram, so "0,5 g" is refused. */
  static bound(raw: string): Weight {
    return Weight.parse(raw, false);
  }

  /** The weight of a parcel: a finer figure is rounded up to the gram, as the taxable weight is. */
  static measured(raw: string): Weight {
    return Weight.parse(raw, true);
  }

  /** A weight read back from storage, where it was written valid. */
  static ofGrams(grams: number): Weight {
    if (!Number.isSafeInteger(grams) || grams < 1 || grams > MAX_WEIGHT_GRAMS) throw new InvalidPricingField('weight');
    return new Weight(grams);
  }

  private static parse(raw: string, roundUp: boolean): Weight {
    const match = typeof raw === 'string' && raw.length <= MAX_TEXT_LENGTH ? WEIGHT.exec(raw) : null;
    if (!match) throw new InvalidPricingField('weight');
    const whole = Number(match[1]);
    const fraction = match[2] ?? '';
    const kilograms = match[3] === 'kg';
    // Digits of the fraction that fit in a gram (3 for kg, none for g), and the rest, which only counts when it is not zero.
    const exactDigits = kilograms ? 3 : 0;
    const gramsFromFraction = exactDigits === 0 ? 0 : Number(fraction.slice(0, exactDigits).padEnd(exactDigits, '0'));
    const remainder = /[1-9]/.test(fraction.slice(exactDigits));
    if (remainder && !roundUp) throw new InvalidPricingField('weight');
    const grams = (kilograms ? whole * 1000 : whole) + gramsFromFraction + (remainder ? 1 : 0);
    if (grams < 1 || grams > MAX_WEIGHT_GRAMS) throw new InvalidPricingField('weight');
    return new Weight(grams);
  }
}
