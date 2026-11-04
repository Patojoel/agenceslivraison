/** What the agency says of a zone at the moment a scale is written: only its active zones can be priced. */
export interface ZoneDirectory {
  statusOf(zoneId: string): 'active' | 'retired' | 'unknown';
}
