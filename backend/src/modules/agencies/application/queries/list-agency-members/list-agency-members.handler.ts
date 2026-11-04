import { Inject, Injectable } from '@nestjs/common';
import { buildCursorPage } from '@shared/application/pagination/cursor-page';
import { AgencyNotFound } from '../../../domain/exceptions/agency.exceptions';
import { READ_AGENCY_MEMBER_REPOSITORY, ReadAgencyMemberRepository } from '../../ports/read-agency-member.repository';
import { ListAgencyMembersQuery } from './list-agency-members.query';
import { ListAgencyMembersResponse } from './list-agency-members.response';

@Injectable()
export class ListAgencyMembersHandler {
  constructor(@Inject(READ_AGENCY_MEMBER_REPOSITORY) private readonly members: ReadAgencyMemberRepository) {}

  async handle(query: ListAgencyMembersQuery): Promise<ListAgencyMembersResponse> {
    const rows = await this.members.listActiveForMember({ agencyId: query.agencyId, userId: query.userId, after: query.cursor, limit: query.limit + 1 });
    if (rows.length === 0 && !(await this.members.isActiveMember(query.agencyId, query.userId))) throw new AgencyNotFound();
    return buildCursorPage(rows, query.limit, item => item.membershipId);
  }
}
