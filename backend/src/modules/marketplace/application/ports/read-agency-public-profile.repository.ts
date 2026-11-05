export interface PublicProfileRecord {
  readonly slug: string;
  readonly published: boolean;
  readonly publishedAt: Date;
  readonly unpublishedAt: Date | null;
}

export interface ReadAgencyPublicProfileRepository {
  findRecord(agencyId: string): Promise<PublicProfileRecord | null>;
}

export const READ_AGENCY_PUBLIC_PROFILE_REPOSITORY = Symbol('ReadAgencyPublicProfileRepository');
