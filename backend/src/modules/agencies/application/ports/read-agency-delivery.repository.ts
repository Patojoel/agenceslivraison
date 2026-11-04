import { AgencyRole } from '../../domain/agency-role';
import { AgencyDeliveryState } from '../read-models/agency-delivery.read-model';

export interface ReadAgencyDeliveryRepository {
  /** The role of an active member; `null` for a former member, a stranger and an unknown agency alike. */
  activeRoleOf(agencyId: string, userId: string): Promise<AgencyRole | null>;
  deliveryStateOf(agencyId: string): Promise<AgencyDeliveryState>;
  /**
   * The same, after taking a shared lock on the agency row for the rest of the current transaction: it waits for a
   * zone being retired (which locks the row exclusively) and makes a retirement wait for the caller.
   */
  deliveryStateOfLockedShared(agencyId: string): Promise<AgencyDeliveryState>;
}

export const READ_AGENCY_DELIVERY_REPOSITORY = Symbol('ReadAgencyDeliveryRepository');
