export interface ListRateCardVersionsQuery {
  readonly agencyId: string;
  readonly userId: string;
  /** The `nextCursor` of the previous page: the number of its last version. */
  readonly cursor: number | null;
  readonly limit: number;
}
