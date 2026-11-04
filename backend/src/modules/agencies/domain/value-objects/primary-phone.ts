import { InvalidAgencyField } from '../exceptions/agency.exceptions';

/** Spaces are the only separator accepted; the country code is optional when typed and always stored. */
const CAMEROON_NUMBER = /^(?:\+237)?([26][0-9]{8})$/;

export class PrimaryPhone {
  private constructor(readonly value: string) {}

  static of(raw: string): PrimaryPhone {
    const match = CAMEROON_NUMBER.exec(raw.replace(/[ \t]+/g, ''));
    if (!match) throw new InvalidAgencyField('primaryPhone');
    return new PrimaryPhone(`+237${match[1]}`);
  }
}
