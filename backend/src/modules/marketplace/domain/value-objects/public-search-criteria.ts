import { areaKeyOf, comparisonKeyOf, singleLineOf } from '../comparison-key';
import { PublicCapability } from '../agency-public-view';
import { InvalidPublicSearch } from '../exceptions/marketplace.exceptions';

export interface PublicSearchInput {
  readonly q?: string;
  readonly city?: string;
  readonly district?: string;
  readonly capabilities?: readonly string[];
  readonly limit?: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const TEXT_MIN = 2;
const TEXT_MAX = 80;
const UNSAFE = /[\p{Cc}\p{Cf}]/u;
const CAPABILITIES: readonly PublicCapability[] = ['delivery', 'storage'];

function textOf(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  if (UNSAFE.test(raw)) throw new InvalidPublicSearch();
  const text = singleLineOf(raw);
  const length = Array.from(text).length;
  if (length < TEXT_MIN || length > TEXT_MAX) throw new InvalidPublicSearch();
  return comparisonKeyOf(text);
}

function capabilitiesOf(raw: readonly string[] | undefined): PublicCapability[] {
  const wanted = new Set<PublicCapability>();
  for (const value of raw ?? []) {
    const known = CAPABILITIES.find(capability => capability === value);
    if (known === undefined) throw new InvalidPublicSearch();
    wanted.add(known);
  }
  return CAPABILITIES.filter(capability => wanted.has(capability));
}

/**
 * What a visitor asks of the directory, checked and put in comparison form (UC-03-02, UC-03-03). All the conditions
 * combine; two capabilities together mean the hybrid agencies. A district needs a city, since a district alone names
 * nothing.
 */
export class PublicSearchCriteria {
  private constructor(
    /** The name must contain this (comparison form), or any name when `null`. */
    readonly nameContains: string | null,
    readonly cityKey: string | null,
    readonly districtKey: string | null,
    readonly capabilities: readonly PublicCapability[],
    readonly limit: number,
  ) {}

  static of(input: PublicSearchInput): PublicSearchCriteria {
    const nameContains = textOf(input.q);
    const cityKey = textOf(input.city);
    const districtKey = textOf(input.district);
    if (districtKey !== null && cityKey === null) throw new InvalidPublicSearch();
    const limit = input.limit ?? DEFAULT_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new InvalidPublicSearch();
    return new PublicSearchCriteria(nameContains, cityKey, districtKey, capabilitiesOf(input.capabilities), limit);
  }

  /** The keys a zone must carry to serve the district: the district itself, or the whole city. `null` without a district. */
  get districtAreaKeys(): readonly string[] | null {
    if (this.cityKey === null || this.districtKey === null) return null;
    return [areaKeyOf(this.cityKey, ''), areaKeyOf(this.cityKey, this.districtKey)];
  }

  /** Equal for equivalent searches (case, accents, spacing, order of capabilities), different otherwise: the cursor is tied to it. The page size is free. */
  get canonical(): string {
    return JSON.stringify([this.nameContains, this.cityKey, this.districtKey, this.capabilities]);
  }
}
