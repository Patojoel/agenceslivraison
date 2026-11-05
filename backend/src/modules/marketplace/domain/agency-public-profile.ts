import { AggregateRoot } from '@shared/domain/aggregate-root';
import { UserId } from '@shared/domain/value-objects/user-id';
import { AgencyPublicView } from './agency-public-view';
import { MarketplaceEvent } from './events/marketplace-events';
import { ProfileAlreadyPublished, ProfileNotPublished } from './exceptions/marketplace.exceptions';
import { assertPublishable } from './publication-rules';
import { AgencyId } from './value-objects/agency-id';
import { PublicSlug } from './value-objects/public-slug';

export interface PublicProfileSnapshot {
  readonly agencyId: AgencyId;
  readonly slug: PublicSlug;
  readonly published: boolean;
  /** The date of the last publication. */
  readonly publishedAt: Date;
  readonly publishedBy: UserId;
  /** `null` while published. */
  readonly unpublishedAt: Date | null;
}

export interface FirstPublication {
  readonly agencyId: AgencyId;
  readonly slug: PublicSlug;
  readonly view: AgencyPublicView;
  readonly actorId: UserId;
  readonly now: Date;
}

type State = { -readonly [K in keyof PublicProfileSnapshot]: PublicProfileSnapshot[K] };

/**
 * Whether an agency shows itself on the marketplace, and under which address. The address is given by the first publication
 * and never changes; the profile is never deleted, so no address is ever given to another agency. Whether a published
 * profile is visible is decided by `obstaclesOf`, not stored here: it follows the agency.
 */
export class AgencyPublicProfile extends AggregateRoot<MarketplaceEvent> {
  private constructor(private readonly state: State) {
    super();
  }

  static publishFirst(input: FirstPublication): AgencyPublicProfile {
    assertPublishable(input.agencyId.value, input.view);
    const profile = new AgencyPublicProfile({ agencyId: input.agencyId, slug: input.slug, published: true, publishedAt: input.now, publishedBy: input.actorId, unpublishedAt: null });
    profile.record({ type: 'AgencyPublicProfilePublished', agencyId: input.agencyId.value, actorId: input.actorId.value });
    return profile;
  }

  static reconstitute(snapshot: PublicProfileSnapshot): AgencyPublicProfile {
    return new AgencyPublicProfile({ ...snapshot });
  }

  snapshot(): PublicProfileSnapshot {
    return { ...this.state };
  }

  publish(view: AgencyPublicView, actorId: UserId, now: Date): void {
    if (this.state.published) throw new ProfileAlreadyPublished();
    assertPublishable(this.state.agencyId.value, view);
    this.state.published = true;
    this.state.publishedAt = now;
    this.state.publishedBy = actorId;
    this.state.unpublishedAt = null;
    this.record({ type: 'AgencyPublicProfilePublished', agencyId: this.state.agencyId.value, actorId: actorId.value });
  }

  unpublish(actorId: UserId, now: Date): void {
    if (!this.state.published) throw new ProfileNotPublished();
    this.state.published = false;
    this.state.unpublishedAt = now;
    this.record({ type: 'AgencyPublicProfileUnpublished', agencyId: this.state.agencyId.value, actorId: actorId.value });
  }
}
