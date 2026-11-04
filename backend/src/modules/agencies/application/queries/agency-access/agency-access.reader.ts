import { Inject, Injectable } from '@nestjs/common';
import { AgencyRole } from '../../../domain/agency-role';
import { READ_AGENCY_DELIVERY_REPOSITORY, ReadAgencyDeliveryRepository } from '../../ports/read-agency-delivery.repository';
import { AgencyDeliveryState } from '../../read-models/agency-delivery.read-model';

/**
 * What `agencies` exposes to the modules that work for an agency (pricing first): who the caller is in it, and what its
 * delivery side looks like. Read only; the other modules never reach the tables behind it.
 */
@Injectable()
export class AgencyAccessReader {
  constructor(@Inject(READ_AGENCY_DELIVERY_REPOSITORY) private readonly delivery: ReadAgencyDeliveryRepository) {}

  activeRoleOf(agencyId: string, userId: string): Promise<AgencyRole | null> {
    return this.delivery.activeRoleOf(agencyId, userId);
  }

  deliveryStateOf(agencyId: string): Promise<AgencyDeliveryState> {
    return this.delivery.deliveryStateOf(agencyId);
  }

  /** Only to be called once the caller's role was checked, so that a stranger cannot hold up the agency. */
  deliveryStateOfLockedShared(agencyId: string): Promise<AgencyDeliveryState> {
    return this.delivery.deliveryStateOfLockedShared(agencyId);
  }
}
