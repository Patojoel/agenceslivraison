import { InvalidAgencyField } from './exceptions/agency.exceptions';
import { AgencySiteId } from './value-objects/agency-site-id';
import { SiteAddress } from './value-objects/site-address';
import { SiteCity } from './value-objects/site-city';
import { SiteName } from './value-objects/site-name';
import { SitePhone } from './value-objects/site-phone';

/** A place where the agency works (counter, depot). It has its own version: it is edited independently of the agency. */
export interface AgencySite {
  readonly id: AgencySiteId;
  readonly name: SiteName;
  readonly city: SiteCity;
  readonly address: SiteAddress;
  readonly phone: SitePhone | null;
  readonly createdAt: Date;
  readonly deactivatedAt: Date | null;
  readonly version: number;
}

export interface SiteDetails {
  readonly name: SiteName;
  readonly city: SiteCity;
  readonly address: SiteAddress;
  readonly phone: SitePhone | null;
}

export const SITE_FIELDS = ['name', 'city', 'address', 'phone'] as const satisfies readonly (keyof SiteDetails)[];
export type SiteField = typeof SITE_FIELDS[number];

/** A field left out is untouched; `null` clears the phone. */
export interface SiteChange {
  readonly name?: SiteName;
  readonly city?: SiteCity;
  readonly address?: SiteAddress;
  readonly phone?: SitePhone | null;
}

export interface RawSiteDetails {
  readonly name: string;
  readonly city: string;
  readonly address: string;
  readonly phone?: string | null;
}

export interface RawSiteChange {
  readonly name?: string | null;
  readonly city?: string | null;
  readonly address?: string | null;
  readonly phone?: string | null;
}

/** Blank text and `null` both mean "no phone". */
function phoneOf(raw: string | null | undefined): SitePhone | null {
  return raw === null || raw === undefined || raw.trim() === '' ? null : SitePhone.of(raw);
}

export function siteDetailsOf(raw: RawSiteDetails): SiteDetails {
  return { name: SiteName.of(raw.name), city: SiteCity.of(raw.city), address: SiteAddress.of(raw.address), phone: phoneOf(raw.phone) };
}

function required<T>(raw: string | null | undefined, field: string, of: (text: string) => T): T | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) throw new InvalidAgencyField(field);
  return of(raw);
}

export function siteChangeOf(raw: RawSiteChange): SiteChange {
  return {
    name: required(raw.name, 'name', SiteName.of),
    city: required(raw.city, 'city', SiteCity.of),
    address: required(raw.address, 'address', SiteAddress.of),
    phone: raw.phone === undefined ? undefined : phoneOf(raw.phone),
  };
}
