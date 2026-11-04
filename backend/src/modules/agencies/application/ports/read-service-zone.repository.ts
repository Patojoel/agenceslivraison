import { ServiceZoneReadModel } from '../read-models/service-zone.read-model';

export interface ListServiceZonesCriteria {
  readonly agencyId: string;
  readonly userId: string;
  /** Identifier of the last zone of the previous page. */
  readonly after: string | null;
  readonly limit: number;
}

export interface ReadServiceZoneRepository {
  /**
   * Active zones first, then retired ones, each by city, district and identifier; at most `limit` rows.
   * `null` when the agency does not exist or the user has no active membership in it.
   */
  listForMember(criteria: ListServiceZonesCriteria): Promise<readonly ServiceZoneReadModel[] | null>;
}

export const READ_SERVICE_ZONE_REPOSITORY = Symbol('ReadServiceZoneRepository');
