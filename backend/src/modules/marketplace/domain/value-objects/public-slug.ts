import { InvalidPublicSlug } from '../exceptions/marketplace.exceptions';

const MIN_LENGTH = 3;
const MAX_LENGTH = 80;
const SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Lower case, no accents, every run of other characters reduced to one dash, none at the edges. */
function baseOf(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * The public address of an agency: computed once, from the name, and never changed or given to another agency (the
 * profile row is never deleted). A collision takes a numeric suffix, `-2`, `-3`...
 */
export class PublicSlug {
  private constructor(readonly value: string) {}

  /** Whether an address of at least three characters can be made of the name. */
  static derivable(name: string): boolean {
    return baseOf(name).length >= MIN_LENGTH;
  }

  /** `attempt` 1 is the bare slug; the suffix counts in the 80 characters. */
  static fromName(name: string, attempt: number): PublicSlug {
    const base = baseOf(name);
    if (base.length < MIN_LENGTH) throw new InvalidPublicSlug();
    const suffix = attempt <= 1 ? '' : `-${attempt}`;
    return new PublicSlug(base.slice(0, MAX_LENGTH - suffix.length).replace(/-+$/, '') + suffix);
  }

  static reconstitute(value: string): PublicSlug {
    if (value.length < MIN_LENGTH || value.length > MAX_LENGTH || !SHAPE.test(value)) throw new InvalidPublicSlug();
    return new PublicSlug(value);
  }
}
