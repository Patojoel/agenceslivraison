export interface ListMyAgenciesQuery {
  readonly userId: string;
  readonly limit: number;
  /** Last `agencyId` of the previous page. */
  readonly cursor: string | null;
}
