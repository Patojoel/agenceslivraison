import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { QuoteNotFound } from '../../../domain/exceptions/pricing.exceptions';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { QuoteId } from '../../../domain/value-objects/quote-id';
import { mayReadPricing } from '../../pricing-rights';
import { AGENCY_ACCESS, AgencyAccess } from '../../ports/agency-access.port';
import { READ_QUOTE_REPOSITORY, ReadQuoteRepository } from '../../ports/read-quote.repository';
import { toQuoteReadModel } from '../../read-models/quote.read-model';
import { requireRole } from '../../require-role';
import { GetQuoteQuery } from './get-quote.query';
import { GetQuoteResponse } from './get-quote.response';

@Injectable()
export class GetQuoteHandler {
  constructor(
    @Inject(AGENCY_ACCESS) private readonly access: AgencyAccess,
    @Inject(READ_QUOTE_REPOSITORY) private readonly quotes: ReadQuoteRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** The quote is looked up inside the agency of the path only: the identifier of a quote of another agency is "not found". */
  async handle(query: GetQuoteQuery): Promise<GetQuoteResponse> {
    const agencyId = AgencyId.of(query.agencyId).value;
    const quoteId = QuoteId.of(query.quoteId).value;
    await requireRole(this.access, agencyId, query.userId, mayReadPricing);
    const record = await this.quotes.findRecord(agencyId, quoteId);
    if (!record) throw new QuoteNotFound();
    return toQuoteReadModel(record, this.clock.now());
  }
}
