import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { UserId } from '@shared/domain/value-objects/user-id';
import { ProfileNotPublished } from '../../../domain/exceptions/marketplace.exceptions';
import { AGENCY_PUBLIC_PROFILE_REPOSITORY, AgencyPublicProfileRepository } from '../../../domain/ports/agency-public-profile.repository';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { mayPublishProfile } from '../../marketplace-rights';
import { AGENCY_ACCESS, AgencyAccess } from '../../ports/agency-access.port';
import { toPublicProfileState } from '../../read-models/public-profile-state.read-model';
import { lockAgencyForWrite } from '../../require-role';
import { UnpublishPublicProfileCommand } from './unpublish-public-profile.command';
import { UnpublishPublicProfileResponse } from './unpublish-public-profile.response';

@Injectable()
export class UnpublishPublicProfileHandler implements CommandHandler<UnpublishPublicProfileCommand, UnpublishPublicProfileResponse> {
  constructor(
    @Inject(AGENCY_ACCESS) private readonly access: AgencyAccess,
    @Inject(AGENCY_PUBLIC_PROFILE_REPOSITORY) private readonly profiles: AgencyPublicProfileRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: UnpublishPublicProfileCommand): Promise<UnpublishPublicProfileResponse> {
    const agencyId = AgencyId.of(command.agencyId);
    const actorId = UserId.of(command.actorId);
    const view = await lockAgencyForWrite(this.access, agencyId.value, actorId.value, mayPublishProfile);
    const profile = await this.profiles.lockByAgency(agencyId);
    if (!profile) throw new ProfileNotPublished();
    profile.unpublish(actorId, this.clock.now());
    await this.profiles.save(profile);
    await this.events.publish(profile.pullEvents());
    const { slug, published, publishedAt, unpublishedAt } = profile.snapshot();
    return toPublicProfileState(agencyId.value, { slug: slug.value, published, publishedAt, unpublishedAt }, view);
  }
}
