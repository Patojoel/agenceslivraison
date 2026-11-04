/** What the agency says of a zone at the moment a scale is written: only its active zones can be priced. */
export interface ZoneDirectory {
  statusOf(zoneId: string): 'active' | 'retired' | 'unknown';
}

/** A zone of the agency as a person reads it, and whether it is still served. */
export interface ZoneView {
  readonly id: string;
  readonly city: string;
  readonly district: string | null;
  readonly active: boolean;
}
