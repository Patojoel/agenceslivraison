import { InvalidAgencyField } from '../exceptions/agency.exceptions';

const TAB = 0x09;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const CONTROL = /\p{Cc}/u;
const FORMAT = /\p{Cf}/u;

/**
 * The one definition of what no text of an agency may contain: control characters (`Cc`, NUL included, which PostgreSQL
 * refuses) and format characters (`Cf`: bidi marks, zero-width characters, byte order mark, soft hyphen), which make two
 * different-looking texts read alike or hide what a name says. Tab, line feed and carriage return are the only controls
 * kept, and only where `allowLineBreaks` says that the text may span lines.
 */
export function hasUnsafeCharacters(raw: string, allowLineBreaks: boolean): boolean {
  for (const char of raw) {
    if (FORMAT.test(char)) return true;
    if (!CONTROL.test(char)) continue;
    const code = char.codePointAt(0) ?? 0;
    const lineBreak = code === TAB || code === LINE_FEED || code === CARRIAGE_RETURN;
    if (!(allowLineBreaks && lineBreak)) return true;
  }
  return false;
}

/** Characters, as PostgreSQL's `char_length` counts them, so a database check never disagrees. */
export function characterCount(value: string): number {
  return Array.from(value).length;
}

function checked(value: string, raw: string, field: string, min: number, max: number): string {
  const length = characterCount(value);
  if (hasUnsafeCharacters(raw, true) || length < min || length > max) throw new InvalidAgencyField(field);
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
