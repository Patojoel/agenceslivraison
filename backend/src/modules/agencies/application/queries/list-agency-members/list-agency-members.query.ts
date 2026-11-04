export interface ListAgencyMembersQuery {
  readonly agencyId: string;
  readonly userId: string;
  readonly limit: number;
  /** Last membership identifier of the previous page. */
  readonly cursor: string | null;
}
