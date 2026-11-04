import { QuoteReadModel } from '../../read-models/quote.read-model';

export interface IssueQuoteResponse {
  /** `true` when the idempotency key had already issued this quote: it is returned as it was, nothing was written. */
  readonly replayed: boolean;
  readonly quote: QuoteReadModel;
}
