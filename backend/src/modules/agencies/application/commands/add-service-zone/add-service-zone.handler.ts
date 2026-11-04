import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { UUID_GENERATOR, UuidGenerator } from '@shared/domain/ports/uuid-generator.port';
import { AGENCY_REPOSITORY, AgencyRepository } from '../../../domain/ports/agency.repository';
import { AGENCY_TEAM_REPOSITORY, AgencyTeamRepository } from '../../../domain/ports/agency-team.repository';
import { ServiceArea } from '../../../domain/value-objects/service-area';
import { ServiceZoneId } from '../../../domain/value-objects/service-zone-id';
import { toServiceZoneReadModel } from '../../read-models/service-zone.read-model';
import { loadAgencyForEdition } from '../load-agency-for-edition';
import { AddServiceZoneCommand } from './add-service-zone.command';
import { AddServiceZoneResponse } from './add-service-zone.response';

@Injectable()
export class AddServiceZoneHandler implements CommandHandler<AddServiceZoneCommand, AddServiceZoneResponse> {
  constructor(
    @Inject(AGENCY_TEAM_REPOSITORY) private readonly teams: AgencyTeamRepository,
    @Inject(AGENCY_REPOSITORY) private readonly agencies: AgencyRepository,
    @Inject(UUID_GENERATOR) private readonly uuid: UuidGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: AddServiceZoneCommand): Promise<AddServiceZoneResponse> {
    const { agency, actorId } = await loadAgencyForEdition(this.teams, this.agencies, command.agencyId, command.actorId);
    const zone = agency.addZone(ServiceZoneId.of(this.uuid.generate()), ServiceArea.of(command.city, command.district), actorId, this.clock.now());
    await this.agencies.save(agency);
    await this.events.publish(agency.pullEvents());
    return toServiceZoneReadModel(zone);
  }
}
