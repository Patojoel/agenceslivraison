import { InvalidAgencyField } from '../exceptions/agency.exceptions';

export class Niu {
  private constructor(readonly value: string) {}

  static of(raw: string): Niu {
    const value = raw.trim();
    if (!/^[A-Za-z0-9]{14}$/.test(value)) throw new InvalidAgencyField('niu');
    return new Niu(value);
  }
}
