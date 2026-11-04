import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { UUID_GENERATOR, UuidGenerator } from '@shared/domain/ports/uuid-generator.port';
import { UserId } from '@shared/domain/value-objects/user-id';
import { RateCard } from '../../../domain/rate-card';
import { RateCardContent } from '../../../domain/rate-card-content';
import { RATE_CARD_REPOSITORY, RateCardRepository } from '../../../domain/ports/rate-card.repository';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { RateCardId } from '../../../domain/value-objects/rate-card-id';
import { mayWriteRateCard } from '../../pricing-rights';
import { AGENCY_ACCESS, AgencyAccess } from '../../ports/agency-access.port';
import { recordOfVersion, toRateCardReadModel } from '../../read-models/rate-card.read-model';
import { lockAgencyForWrite, zoneDirectoryOf } from '../../require-role';
import { CreateRateCardCommand } from './create-rate-card.command';
import { CreateRateCardResponse } from './create-rate-card.response';

@Injectable()
export class CreateRateCardHandler implements CommandHandler<CreateRateCardCommand, CreateRateCardResponse> {
  constructor(
    @Inject(AGENCY_ACCESS) private readonly access: AgencyAccess,
    @Inject(RATE_CARD_REPOSITORY) private readonly rateCards: RateCardRepository,
    @Inject(UUID_GENERATOR) private readonly ids: UuidGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: CreateRateCardCommand): Promise<CreateRateCardResponse> {
    const agencyId = AgencyId.of(command.agencyId);
    const actorId = UserId.of(command.actorId);
    const state = await lockAgencyForWrite(this.access, agencyId.value, actorId.value, mayWriteRateCard);
    const card = RateCard.create({
      id: RateCardId.of(this.ids.generate()),
      agencyId,
      content: RateCardContent.of(command.volumetricDivisor, command.lines),
      zones: zoneDirectoryOf(state),
      authorId: actorId,
      now: this.clock.now(),
    });
    await this.rateCards.add(card);
    await this.events.publish(card.pullEvents());
    const { id, current } = card.snapshot();
    return toRateCardReadModel(recordOfVersion(id.value, current), state.zones);
  }
}
