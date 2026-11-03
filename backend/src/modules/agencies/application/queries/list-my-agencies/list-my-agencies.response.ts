export interface MyAgencyDto {
  readonly agencyId: string;
  readonly role: string;
}

export interface ListMyAgenciesResponse {
  readonly items: readonly MyAgencyDto[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}
