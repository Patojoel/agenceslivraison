import { Inject, Injectable } from '@nestjs/common';
import { MarketplaceAgencyNotFound } from '../../../domain/exceptions/marketplace.exceptions';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { mayReadProfileState } from '../../marketplace-rights';
import { AGENCY_ACCESS, AgencyAccess } from '../../ports/agency-access.port';
import { READ_AGENCY_PUBLIC_PROFILE_REPOSITORY, ReadAgencyPublicProfileRepository } from '../../ports/read-agency-public-profile.repository';
import { toPublicProfileState } from '../../read-models/public-profile-state.read-model';
import { requireRole } from '../../require-role';
import { GetPublicProfileQuery } from './get-public-profile.query';
import { GetPublicProfileResponse } from './get-public-profile.response';

@Injectable()
export class GetPublicProfileHandler {
  constructor(
    @Inject(AGENCY_ACCESS) private readonly access: AgencyAccess,
    @Inject(READ_AGENCY_PUBLIC_PROFILE_REPOSITORY) private readonly profiles: ReadAgencyPublicProfileRepository,
  ) {}

  /** The profile of the agency of the path only: the state of another agency's fiche is "not found". */
  async handle(query: GetPublicProfileQuery): Promise<GetPublicProfileResponse> {
    const agencyId = AgencyId.of(query.agencyId).value;
    await requireRole(this.access, agencyId, query.userId, mayReadProfileState);
    const view = await this.access.publicViewOf(agencyId);
    if (view === null) throw new MarketplaceAgencyNotFound();
    return toPublicProfileState(agencyId, await this.profiles.findRecord(agencyId), view);
  }
}
