import { InvalidTradeName } from '../exceptions/agency.exceptions';
import { hasUnsafeCharacters } from './plain-text';

export const TRADE_NAME_MIN = 2;
export const TRADE_NAME_MAX = 120;

export class TradeName {
  private constructor(readonly value: string) {}

  /** Length is counted in characters, as PostgreSQL's `char_length` does, so the database check never disagrees. */
  static of(raw: string): TradeName {
    const value = raw.trim();
    const length = Array.from(value).length;
    if (hasUnsafeCharacters(raw, true) || hasUnsafeCharacters(value, false) || length < TRADE_NAME_MIN || length > TRADE_NAME_MAX) throw new InvalidTradeName();
    return new TradeName(value);
  }
}
