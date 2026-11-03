export const ID_GENERATOR = Symbol('IdGenerator');

export interface IdGenerator {
  /** Returns a UUID v4. */
  generate(): string;
}
