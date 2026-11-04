export interface ListAgencySitesQuery {
  readonly agencyId: string;
  readonly userId: string;
  readonly cursor: string | null;
  readonly limit: number;
}
