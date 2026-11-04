import { multiLine } from './plain-text';

export const DESCRIPTION_MAX = 1000;

/** Plain text: markup is kept as typed and never interpreted, the display escapes it. A description is never blank. */
export class Description {
  private constructor(readonly value: string) {}

  static of(raw: string): Description {
    return new Description(multiLine(raw, 'description', 1, DESCRIPTION_MAX));
  }

  /** Blank text and `null` both mean "no description". */
  static ofOptional(raw: string | null): Description | null {
    return raw === null || raw.trim() === '' ? null : Description.of(raw);
  }
}
