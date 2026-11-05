import { PublicAgencySummary } from '../../read-models/public-agency.read-model';

export interface SearchPublicAgenciesResponse {
  readonly items: readonly PublicAgencySummary[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}
