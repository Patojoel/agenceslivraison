import { AgencyPublicView } from '../../domain/agency-public-view';
import { obstaclesOf, PublicationObstacle } from '../../domain/publication-rules';
import { PublicProfileRecord } from '../ports/read-agency-public-profile.repository';

/** What the team sees of its fiche: the address, whether it is shown, and what would hide it or prevent its publication. */
export interface PublicProfileState {
  readonly published: boolean;
  readonly slug: string | null;
  readonly publishedAt: string | null;
  readonly unpublishedAt: string | null;
  /** Published and not hidden by any obstacle: what a visitor can find. */
  readonly visible: boolean;
  readonly verification: 'unverified';
  readonly obstacles: readonly PublicationObstacle[];
}

export function toPublicProfileState(agencyId: string, record: PublicProfileRecord | null, view: AgencyPublicView): PublicProfileState {
  const obstacles = obstaclesOf(agencyId, view);
  const published = record?.published === true;
  return {
    published,
    slug: record?.slug ?? null,
    publishedAt: record ? record.publishedAt.toISOString() : null,
    unpublishedAt: record?.unpublishedAt?.toISOString() ?? null,
    visible: published && obstacles.length === 0,
    verification: 'unverified',
    obstacles,
  };
}
