import { Inject, Injectable } from '@nestjs/common';
import { buildCursorPage } from '@shared/application/pagination/cursor-page';
import { READ_AGENCY_MEMBERSHIP_REPOSITORY, ReadAgencyMembershipRepository } from '../../ports/read-agency-membership.repository';
import { ListMyAgenciesQuery } from './list-my-agencies.query';
import { ListMyAgenciesResponse } from './list-my-agencies.response';

@Injectable()
export class ListMyAgenciesHandler {
  constructor(@Inject(READ_AGENCY_MEMBERSHIP_REPOSITORY) private readonly memberships: ReadAgencyMembershipRepository) {}

  async handle(query: ListMyAgenciesQuery): Promise<ListMyAgenciesResponse> {
    const rows = await this.memberships.listActiveForUser({ userId: query.userId, after: query.cursor, limit: query.limit + 1 });
    return buildCursorPage(rows, query.limit, item => item.agencyId);
  }
}
