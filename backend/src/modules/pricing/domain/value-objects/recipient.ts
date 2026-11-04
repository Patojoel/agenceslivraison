import { InvalidPricingField } from '../exceptions/pricing.exceptions';
import { characterCount, isPlainLine } from './plain-text';

export const RECIPIENT_NAME_MIN = 2;
export const RECIPIENT_NAME_MAX = 120;
/** Spaces are the only separator accepted; the country code is optional when typed and always stored. */
const CAMEROON_NUMBER = /^(?:\+237)?([26][0-9]{8})$/;

/**
 * Who a quote is for: a name and, if known, a Cameroonian phone number. Personal data private to the agency: it is never
 * logged, audited or put in an event.
 */
export class Recipient {
  private constructor(readonly name: string, readonly phone: string | null) {}

  static of(rawName: string, rawPhone: string | null): Recipient {
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    const length = characterCount(name);
    if (!isPlainLine(name) || length < RECIPIENT_NAME_MIN || length > RECIPIENT_NAME_MAX) throw new InvalidPricingField('recipientName');
    if (rawPhone === null) return new Recipient(name, null);
    const match = typeof rawPhone === 'string' ? CAMEROON_NUMBER.exec(rawPhone.replace(/[ \t]+/g, '')) : null;
    if (!match) throw new InvalidPricingField('recipientPhone');
    return new Recipient(name, `+237${match[1]}`);
  }

  /** A recipient read back from storage, where it was written valid. */
  static reconstitute(name: string, phone: string | null): Recipient {
    return new Recipient(name, phone);
  }
}
