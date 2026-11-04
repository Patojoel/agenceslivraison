import { Inject, Injectable } from '@nestjs/common';
import { buildCursorPage } from '@shared/application/pagination/cursor-page';
import { RateCardNotFound } from '../../../domain/exceptions/pricing.exceptions';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { mayReadPricing } from '../../pricing-rights';
import { AGENCY_ACCESS, AgencyAccess } from '../../ports/agency-access.port';
import { READ_RATE_CARD_REPOSITORY, ReadRateCardRepository } from '../../ports/read-rate-card.repository';
import { requireRole } from '../../require-role';
import { ListRateCardVersionsQuery } from './list-rate-card-versions.query';
import { ListRateCardVersionsResponse } from './list-rate-card-versions.response';

@Injectable()
export class ListRateCardVersionsHandler {
  constructor(
    @Inject(AGENCY_ACCESS) private readonly access: AgencyAccess,
    @Inject(READ_RATE_CARD_REPOSITORY) private readonly rateCards: ReadRateCardRepository,
  ) {}

  /** The history, most recent first. An agency without a rate card has none: not found. */
  async handle(query: ListRateCardVersionsQuery): Promise<ListRateCardVersionsResponse> {
    const agencyId = AgencyId.of(query.agencyId).value;
    await requireRole(this.access, agencyId, query.userId, mayReadPricing);
    const rows = await this.rateCards.listVersions({ agencyId, before: query.cursor, limit: query.limit + 1 });
    if (rows.length === 0 && query.cursor === null) throw new RateCardNotFound();
    return buildCursorPage(rows, query.limit, row => String(row.number));
  }
}
