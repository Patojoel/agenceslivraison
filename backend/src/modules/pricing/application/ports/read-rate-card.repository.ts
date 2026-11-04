import { RateCardVersionRecord, VersionSummaryReadModel } from '../read-models/rate-card.read-model';

export interface ListVersionsCriteria {
  readonly agencyId: string;
  /** Exclusive upper bound on the version number, from the previous page; `null` for the first page. */
  readonly before: number | null;
  readonly limit: number;
}

export interface ReadRateCardRepository {
  /** A version of the rate card of the agency with its lines; `null` number for the version in force. `null` when there is none. */
  findVersion(agencyId: string, number: number | null): Promise<RateCardVersionRecord | null>;
  /** From the most recent version to the oldest, at most `limit` rows. */
  listVersions(criteria: ListVersionsCriteria): Promise<readonly VersionSummaryReadModel[]>;
}

export const READ_RATE_CARD_REPOSITORY = Symbol('ReadRateCardRepository');
