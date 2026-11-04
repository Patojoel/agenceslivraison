import { CursorPage } from '@shared/application/pagination/cursor-page';
import { QuoteSummaryReadModel } from '../../read-models/quote.read-model';

export type ListQuotesResponse = CursorPage<QuoteSummaryReadModel>;
