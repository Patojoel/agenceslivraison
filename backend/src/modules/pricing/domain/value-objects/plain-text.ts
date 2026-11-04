const UNSAFE = /[\p{Cc}\p{Cf}]/u;

/** One line without control characters (NUL, line breaks…) or format characters (bidi marks, zero-width characters). */
export function isPlainLine(value: string): boolean {
  return !UNSAFE.test(value);
}

/** Characters, as PostgreSQL's `char_length` counts them, so a database check never disagrees. */
export function characterCount(value: string): number {
  return Array.from(value).length;
}
