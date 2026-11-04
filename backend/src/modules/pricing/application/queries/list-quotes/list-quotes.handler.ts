import { Inject, Injectable } from '@nestjs/common';
import { buildCursorPage } from '@shared/application/pagination/cursor-page';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { mayReadPricing } from '../../pricing-rights';
import { AGENCY_ACCESS, AgencyAccess } from '../../ports/agency-access.port';
import { READ_QUOTE_REPOSITORY, ReadQuoteRepository } from '../../ports/read-quote.repository';
import { toQuoteSummaryReadModel } from '../../read-models/quote.read-model';
import { requireRole } from '../../require-role';
import { ListQuotesQuery } from './list-quotes.query';
import { ListQuotesResponse } from './list-quotes.response';
import { encodeQuoteCursor } from './quote-cursor';

@Injectable()
export class ListQuotesHandler {
  constructor(
    @Inject(AGENCY_ACCESS) private readonly access: AgencyAccess,
    @Inject(READ_QUOTE_REPOSITORY) private readonly quotes: ReadQuoteRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** The quotes of the agency, the most recent first. */
  async handle(query: ListQuotesQuery): Promise<ListQuotesResponse> {
    const agencyId = AgencyId.of(query.agencyId).value;
    await requireRole(this.access, agencyId, query.userId, mayReadPricing);
    const rows = await this.quotes.listSummaries({ agencyId, after: query.cursor, limit: query.limit + 1 });
    const now = this.clock.now();
    return buildCursorPage(rows.map(row => toQuoteSummaryReadModel(row, now)), query.limit, item => encodeQuoteCursor({ issuedAt: item.issuedAt, id: item.id }));
  }
}
