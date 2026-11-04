import { QuoteCursor } from '../../ports/read-quote.repository';

export interface ListQuotesQuery {
  readonly agencyId: string;
  readonly userId: string;
  readonly cursor: QuoteCursor | null;
  readonly limit: number;
}
