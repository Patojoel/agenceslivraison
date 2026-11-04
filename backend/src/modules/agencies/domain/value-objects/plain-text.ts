import { InvalidAgencyField } from '../exceptions/agency.exceptions';

const TAB = 0x09;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const DELETE = 0x7f;

/** Control characters other than tab, line feed and carriage return: PostgreSQL refuses NUL and the rest has no place in a name. */
export function hasControlCharacters(raw: string): boolean {
  for (const char of raw) {
    const code = char.codePointAt(0) ?? 0;
    if (code === DELETE || (code < 0x20 && code !== TAB && code !== LINE_FEED && code !== CARRIAGE_RETURN)) return true;
  }
  return false;
}

/** Characters, as PostgreSQL's `char_length` counts them, so a database check never disagrees. */
export function characterCount(value: string): number {
  return Array.from(value).length;
}

function checked(value: string, raw: string, field: string, min: number, max: number): string {
  const length = characterCount(value);
  if (hasControlCharacters(raw) || length < min || length > max) throw new InvalidAgencyField(field);
  return value;
}

/** One line: edge spaces removed, every inner run of whitespace reduced to a single space. */
export function singleLine(raw: string, field: string, min: number, max: number): string {
  return checked(raw.replace(/\s+/g, ' ').trim(), raw, field, min, max);
}

/** What makes two names "the same": case, accents and spacing are ignored (the text is already a single line). */
export function comparisonKey(singleLineText: string): string {
  return singleLineText.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Several lines allowed; edge spaces removed, nothing else rewritten. */
export function multiLine(raw: string, field: string, min: number, max: number): string {
  return checked(raw.trim(), raw, field, min, max);
}
