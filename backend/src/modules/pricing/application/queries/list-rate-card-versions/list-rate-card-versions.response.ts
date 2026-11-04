import { CursorPage } from '@shared/application/pagination/cursor-page';
import { VersionSummaryReadModel } from '../../read-models/rate-card.read-model';

export type ListRateCardVersionsResponse = CursorPage<VersionSummaryReadModel>;
