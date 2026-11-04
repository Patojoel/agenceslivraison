import { Inject, Injectable } from '@nestjs/common';
import { AgencyNotFound } from '../../../domain/exceptions/agency.exceptions';
import { READ_AGENCY_REPOSITORY, ReadAgencyRepository } from '../../ports/read-agency.repository';
import { GetAgencyQuery } from './get-agency.query';
import { GetAgencyResponse } from './get-agency.response';

@Injectable()
export class GetAgencyHandler {
  constructor(@Inject(READ_AGENCY_REPOSITORY) private readonly agencies: ReadAgencyRepository) {}

  async handle(query: GetAgencyQuery): Promise<GetAgencyResponse> {
    const agency = await this.agencies.findForMember(query.agencyId, query.userId);
    if (!agency) throw new AgencyNotFound();
    return agency;
  }
}
