import { ServiceArea } from './value-objects/service-area';
import { ServiceZoneId } from './value-objects/service-zone-id';

/** An agency serves at most this many zones at once. */
export const MAX_ACTIVE_ZONES = 100;

/** Retired zones are kept, so the total is bounded too: the whole agency is loaded for every configuration write. */
export const MAX_ZONES_TOTAL = 300;

export const SERVICE_ZONE_FIELDS = ['city', 'district'] as const;
export type ServiceZoneField = typeof SERVICE_ZONE_FIELDS[number];

/** A place the agency serves. Retired zones are kept: the same zone comes back, with its identifier, when it is added again. */
export interface ServiceZone {
  readonly id: ServiceZoneId;
  readonly area: ServiceArea;
  readonly addedAt: Date;
  readonly retiredAt: Date | null;
}
