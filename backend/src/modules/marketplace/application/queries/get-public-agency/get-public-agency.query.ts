export interface GetPublicAgencyQuery {
  /** As received: not trusted, and any shape other than a slug is a "not found". */
  readonly slug: string;
}
