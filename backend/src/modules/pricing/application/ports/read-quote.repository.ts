import { QuoteRecord, QuoteSummaryRecord } from '../read-models/quote.read-model';

/** Where the previous page stopped: quotes are listed from the most recent, ties broken by identifier. */
export interface QuoteCursor {
  readonly issuedAt: string;
  readonly id: string;
}

export interface ListQuotesCriteria {
  readonly agencyId: string;
  readonly after: QuoteCursor | null;
  readonly limit: number;
}

export interface ReadQuoteRepository {
  /** A quote of this agency; a quote of another agency is `null`, like an unknown one. */
  findRecord(agencyId: string, quoteId: string): Promise<QuoteRecord | null>;
  /** The most recent first, at most `limit` rows, all of this agency. */
  listSummaries(criteria: ListQuotesCriteria): Promise<readonly QuoteSummaryRecord[]>;
}

export const READ_QUOTE_REPOSITORY = Symbol('ReadQuoteRepository');
