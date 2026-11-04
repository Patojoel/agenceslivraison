import { Email } from '@shared/domain/value-objects/email';
import { InvalidAgencyField } from './exceptions/agency.exceptions';
import { Description } from './value-objects/description';
import { HeadquartersAddress } from './value-objects/headquarters-address';
import { HeadquartersCity } from './value-objects/headquarters-city';
import { LegalName } from './value-objects/legal-name';
import { Niu } from './value-objects/niu';
import { PrimaryPhone } from './value-objects/primary-phone';
import { Rccm } from './value-objects/rccm';
import { TradeName } from './value-objects/trade-name';

/** Who the agency is, legally and for contact. The first four are required to submit; the others are optional. */
export interface AgencyIdentity {
  readonly legalName: LegalName | null;
  readonly headquartersCity: HeadquartersCity | null;
  readonly headquartersAddress: HeadquartersAddress | null;
  readonly primaryPhone: PrimaryPhone | null;
  readonly contactEmail: Email | null;
  readonly rccm: Rccm | null;
  readonly niu: Niu | null;
}

export const EMPTY_IDENTITY: AgencyIdentity = {
  legalName: null, headquartersCity: null, headquartersAddress: null, primaryPhone: null, contactEmail: null, rccm: null, niu: null,
};

export const IDENTITY_FIELDS = ['legalName', 'headquartersCity', 'headquartersAddress', 'primaryPhone', 'contactEmail', 'rccm', 'niu'] as const satisfies readonly (keyof AgencyIdentity)[];
export type IdentityField = typeof IDENTITY_FIELDS[number];

/** A field left out is untouched; `null` clears an optional field. */
export interface IdentityChange {
  readonly legalName?: LegalName;
  readonly headquartersCity?: HeadquartersCity;
  readonly headquartersAddress?: HeadquartersAddress;
  readonly primaryPhone?: PrimaryPhone;
  readonly contactEmail?: Email | null;
  readonly rccm?: Rccm | null;
  readonly niu?: Niu | null;
}

export interface RawIdentityChange {
  readonly legalName?: string | null;
  readonly headquartersCity?: string | null;
  readonly headquartersAddress?: string | null;
  readonly primaryPhone?: string | null;
  readonly contactEmail?: string | null;
  readonly rccm?: string | null;
  readonly niu?: string | null;
}

export const PROFILE_FIELDS = ['tradeName', 'description'] as const;
export type ProfileField = typeof PROFILE_FIELDS[number];

export interface ProfileChange {
  readonly tradeName?: TradeName;
  readonly description?: Description | null;
}

export interface RawProfileChange {
  readonly tradeName?: string | null;
  readonly description?: string | null;
}

function required<T>(raw: string | null | undefined, field: string, of: (text: string) => T): T | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) throw new InvalidAgencyField(field);
  return of(raw);
}

/** Blank text clears the field, like `null`. */
function optional<T>(raw: string | null | undefined, of: (text: string) => T): T | null | undefined {
  if (raw === undefined) return undefined;
  return raw === null || raw.trim() === '' ? null : of(raw);
}

export function identityChangeOf(raw: RawIdentityChange): IdentityChange {
  return {
    legalName: required(raw.legalName, 'legalName', LegalName.of),
    headquartersCity: required(raw.headquartersCity, 'headquartersCity', HeadquartersCity.of),
    headquartersAddress: required(raw.headquartersAddress, 'headquartersAddress', HeadquartersAddress.of),
    primaryPhone: required(raw.primaryPhone, 'primaryPhone', PrimaryPhone.of),
    contactEmail: optional(raw.contactEmail, Email.of),
    rccm: optional(raw.rccm, Rccm.of),
    niu: optional(raw.niu, Niu.of),
  };
}

export function profileChangeOf(raw: RawProfileChange): ProfileChange {
  return {
    tradeName: raw.tradeName === undefined ? undefined : TradeName.of(raw.tradeName ?? ''),
    description: raw.description === undefined ? undefined : Description.ofOptional(raw.description),
  };
}

type Valued = { readonly value: string } | null;

/** The fields (among `order`) a change really modifies, compared by value. */
export function changedFields<K extends string>(order: readonly K[], current: Readonly<Record<K, Valued>>, change: Readonly<Partial<Record<K, Valued>>>): K[] {
  return order.filter(key => {
    const next = change[key];
    return next !== undefined && next?.value !== current[key]?.value;
  });
}

/** `current` with the given fields replaced by their value in `change`. */
export function withFields<K extends string, T extends Readonly<Record<K, Valued>>>(current: T, change: Readonly<Partial<Record<K, Valued>>>, fields: readonly K[]): T {
  const next: Record<string, Valued> = { ...current };
  for (const field of fields) next[field] = change[field] ?? null;
  return next as T;
}
