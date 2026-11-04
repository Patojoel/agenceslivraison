import { Injectable } from '@nestjs/common';
import { AgencyAccessReader } from '@modules/agencies/application/queries/agency-access/agency-access.reader';
import { AgencyAccess, DeliveryAgencyState, MemberRole } from '../../application/ports/agency-access.port';

/** The adapter of the port: what `agencies` exposes (`AgencyAccessReader`), and nothing else of that module. */
@Injectable()
export class AgenciesAgencyAccess implements AgencyAccess {
  constructor(private readonly reader: AgencyAccessReader) {}

  activeRoleOf(agencyId: string, userId: string): Promise<MemberRole | null> {
    return this.reader.activeRoleOf(agencyId, userId);
  }

  deliveryState(agencyId: string): Promise<DeliveryAgencyState> {
    return this.reader.deliveryStateOf(agencyId);
  }

  deliveryStateLockedShared(agencyId: string): Promise<DeliveryAgencyState> {
    return this.reader.deliveryStateOfLockedShared(agencyId);
  }
}
