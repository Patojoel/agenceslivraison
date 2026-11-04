import { comparisonKey, singleLine } from './plain-text';

/** Where an agency operates: a city, optionally narrowed to a district; without district it covers the whole city. */
export class ServiceArea {
  private constructor(readonly city: string, readonly district: string | null) {}

  static of(rawCity: string, rawDistrict: string | null | undefined): ServiceArea {
    const city = singleLine(rawCity, 'city', 2, 80);
    const district = rawDistrict === null || rawDistrict === undefined || rawDistrict.trim() === '' ? null : singleLine(rawDistrict, 'district', 2, 80);
    return new ServiceArea(city, district);
  }

  get cityKey(): string { return comparisonKey(this.city); }

  /** Empty when there is no district: it keeps the pair usable in a unique index. */
  get districtKey(): string { return this.district === null ? '' : comparisonKey(this.district); }

  sameAs(other: ServiceArea): boolean {
    return this.cityKey === other.cityKey && this.districtKey === other.districtKey;
  }
}
