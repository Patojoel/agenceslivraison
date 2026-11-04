import { Inject, Injectable } from '@nestjs/common';
import { buildCursorPage } from '@shared/application/pagination/cursor-page';
import { AgencyNotFound } from '../../../domain/exceptions/agency.exceptions';
import { READ_AGENCY_SITE_REPOSITORY, ReadAgencySiteRepository } from '../../ports/read-agency-site.repository';
import { ListAgencySitesQuery } from './list-agency-sites.query';
import { ListAgencySitesResponse } from './list-agency-sites.response';

@Injectable()
export class ListAgencySitesHandler {
  constructor(@Inject(READ_AGENCY_SITE_REPOSITORY) private readonly sites: ReadAgencySiteRepository) {}

  async handle(query: ListAgencySitesQuery): Promise<ListAgencySitesResponse> {
    const rows = await this.sites.listForMember({ agencyId: query.agencyId, userId: query.userId, after: query.cursor, limit: query.limit + 1 });
    if (rows === null) throw new AgencyNotFound();
    return buildCursorPage(rows, query.limit, site => site.id);
  }
}
