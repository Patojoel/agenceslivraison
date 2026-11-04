import { ServiceArea } from './value-objects/service-area';
import { ServiceZoneId } from './value-objects/service-zone-id';

/** An agency serves at most this many zones at once. */
export const MAX_ACTIVE_ZONES = 100;

/** A place the agency serves. Retired zones are kept: the same zone comes back, with its identifier, when it is added again. */
export interface ServiceZone {
  readonly id: ServiceZoneId;
  readonly area: ServiceArea;
  readonly addedAt: Date;
  readonly retiredAt: Date | null;
}
