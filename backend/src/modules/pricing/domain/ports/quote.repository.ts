import { Quote } from '../quote';
import { AgencyId } from '../value-objects/agency-id';
import { QuoteId } from '../value-objects/quote-id';

export const QUOTE_REPOSITORY = Symbol('QuoteRepository');

export interface QuoteRepository {
  /**
   * The next number of the quotes of the agency for the year: 1, 2, 3 without a gap, whoever asks at the same time. The
   * counter of the agency stays locked until the transaction ends, so two emissions never get the same number.
   */
  nextNumber(agencyId: AgencyId, year: number): Promise<number>;
  add(quote: Quote): Promise<void>;
  /** The quote of this agency, if there is one: a quote of another agency is `null`, like an unknown one. */
  findById(agencyId: AgencyId, quoteId: QuoteId): Promise<Quote | null>;
  /** The same, holding the quote until the transaction ends: the first step of its acceptance. */
  lockById(agencyId: AgencyId, quoteId: QuoteId): Promise<Quote | null>;
  /** Writes the acceptance, only if the quote is still issued in storage; otherwise `QuoteAlreadyAccepted`. */
  save(quote: Quote): Promise<void>;
}
