import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { UserId } from '@shared/domain/value-objects/user-id';
import { RateCardNotFound } from '../../../domain/exceptions/pricing.exceptions';
import { RateCardContent } from '../../../domain/rate-card-content';
import { RATE_CARD_REPOSITORY, RateCardRepository } from '../../../domain/ports/rate-card.repository';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { mayWriteRateCard } from '../../pricing-rights';
import { AGENCY_ACCESS, AgencyAccess } from '../../ports/agency-access.port';
import { recordOfVersion, toRateCardReadModel } from '../../read-models/rate-card.read-model';
import { lockAgencyForWrite, zoneDirectoryOf } from '../../require-role';
import { PublishRateCardVersionCommand } from './publish-rate-card-version.command';
import { PublishRateCardVersionResponse } from './publish-rate-card-version.response';

@Injectable()
export class PublishRateCardVersionHandler implements CommandHandler<PublishRateCardVersionCommand, PublishRateCardVersionResponse> {
  constructor(
    @Inject(AGENCY_ACCESS) private readonly access: AgencyAccess,
    @Inject(RATE_CARD_REPOSITORY) private readonly rateCards: RateCardRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: PublishRateCardVersionCommand): Promise<PublishRateCardVersionResponse> {
    const agencyId = AgencyId.of(command.agencyId);
    const actorId = UserId.of(command.actorId);
    const state = await lockAgencyForWrite(this.access, agencyId.value, actorId.value, mayWriteRateCard);
    const card = await this.rateCards.lockByAgency(agencyId);
    if (!card) throw new RateCardNotFound();
    const changed = card.publish({
      basedOn: command.expectedVersion,
      content: RateCardContent.of(command.volumetricDivisor, command.lines),
      zones: zoneDirectoryOf(state),
      authorId: actorId,
      now: this.clock.now(),
    });
    if (changed) {
      await this.rateCards.save(card);
      await this.events.publish(card.pullEvents());
    }
    const { id, current } = card.snapshot();
    return { changed, rateCard: toRateCardReadModel(recordOfVersion(id.value, current), state.zones) };
  }
}
