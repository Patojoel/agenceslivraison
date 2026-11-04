import { InvalidAgencyField } from '../exceptions/agency.exceptions';

/** Spaces are the only separator accepted; the country code is optional when typed and always stored. */
const CAMEROON_NUMBER = /^(?:\+237)?([26][0-9]{8})$/;

/** `+237` and nine digits starting with 2 or 6. `field` names what the person typed when it is refused. */
export function cameroonPhone(raw: string, field: string): string {
  const match = CAMEROON_NUMBER.exec(raw.replace(/[ \t]+/g, ''));
  if (!match) throw new InvalidAgencyField(field);
  return `+237${match[1]}`;
}
