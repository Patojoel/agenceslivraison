export const UUID_GENERATOR = Symbol('UuidGenerator');

export interface UuidGenerator {
  /** Returns a UUID v4. */
  generate(): string;
}
