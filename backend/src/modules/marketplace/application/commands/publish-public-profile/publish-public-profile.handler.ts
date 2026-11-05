import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { UserId } from '@shared/domain/value-objects/user-id';
import { AgencyPublicProfile } from '../../../domain/agency-public-profile';
import { AgencyPublicView } from '../../../domain/agency-public-view';
import { ProfileAlreadyPublished, PublicSlugUnavailable } from '../../../domain/exceptions/marketplace.exceptions';
import { AGENCY_PUBLIC_PROFILE_REPOSITORY, AgencyPublicProfileRepository } from '../../../domain/ports/agency-public-profile.repository';
import { assertPublishable } from '../../../domain/publication-rules';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { PublicSlug } from '../../../domain/value-objects/public-slug';
import { mayPublishProfile } from '../../marketplace-rights';
import { AGENCY_ACCESS, AgencyAccess } from '../../ports/agency-access.port';
import { toPublicProfileState } from '../../read-models/public-profile-state.read-model';
import { lockAgencyForWrite } from '../../require-role';
import { PublishPublicProfileCommand } from './publish-public-profile.command';
import { PublishPublicProfileResponse } from './publish-public-profile.response';

/** More homonymous agencies than this are not expected: past it the refusal is explicit rather than an endless loop. */
const MAX_SLUG_ATTEMPTS = 50;

@Injectable()
export class PublishPublicProfileHandler implements CommandHandler<PublishPublicProfileCommand, PublishPublicProfileResponse> {
  constructor(
    @Inject(AGENCY_ACCESS) private readonly access: AgencyAccess,
    @Inject(AGENCY_PUBLIC_PROFILE_REPOSITORY) private readonly profiles: AgencyPublicProfileRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: PublishPublicProfileCommand): Promise<PublishPublicProfileResponse> {
    const agencyId = AgencyId.of(command.agencyId);
    const actorId = UserId.of(command.actorId);
    const view = await lockAgencyForWrite(this.access, agencyId.value, actorId.value, mayPublishProfile);
    const now = this.clock.now();
    const existing = await this.profiles.lockByAgency(agencyId);
    const profile = existing ?? await this.addFirst(agencyId, actorId, view, now);
    if (existing) {
      existing.publish(view, actorId, now);
      await this.profiles.save(existing);
    }
    await this.events.publish(profile.pullEvents());
    const { slug, published, publishedAt, unpublishedAt } = profile.snapshot();
    return toPublicProfileState(agencyId.value, { slug: slug.value, published, publishedAt, unpublishedAt }, view);
  }

  /**
   * The address is the name's, then the name's with `-2`, `-3`... Each try is one `INSERT ... ON CONFLICT DO NOTHING`: a
   * taken address, even one taken by a request still to commit, does not abort the transaction. The unique index is what
   * makes two homonymous agencies published at once end with two addresses.
   */
  private async addFirst(agencyId: AgencyId, actorId: UserId, view: AgencyPublicView, now: Date): Promise<AgencyPublicProfile> {
    assertPublishable(agencyId.value, view);
    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
      const profile = AgencyPublicProfile.publishFirst({ agencyId, slug: PublicSlug.fromName(view.tradeName, attempt), view, actorId, now });
      const outcome = await this.profiles.add(profile);
      if (outcome === 'added') return profile;
      if (outcome === 'already_has_profile') throw new ProfileAlreadyPublished();
    }
    throw new PublicSlugUnavailable();
  }
}
