import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { AGENCY_REPOSITORY, AgencyRepository } from '../../../domain/ports/agency.repository';
import { AGENCY_TEAM_REPOSITORY, AgencyTeamRepository } from '../../../domain/ports/agency-team.repository';
import { ServiceArea } from '../../../domain/value-objects/service-area';
import { ServiceZoneId } from '../../../domain/value-objects/service-zone-id';
import { toServiceZoneReadModel } from '../../read-models/service-zone.read-model';
import { loadAgencyForEdition } from '../load-agency-for-edition';
import { CorrectServiceZoneCommand } from './correct-service-zone.command';
import { CorrectServiceZoneResponse } from './correct-service-zone.response';

@Injectable()
export class CorrectServiceZoneHandler implements CommandHandler<CorrectServiceZoneCommand, CorrectServiceZoneResponse> {
  constructor(
    @Inject(AGENCY_TEAM_REPOSITORY) private readonly teams: AgencyTeamRepository,
    @Inject(AGENCY_REPOSITORY) private readonly agencies: AgencyRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: CorrectServiceZoneCommand): Promise<CorrectServiceZoneResponse> {
    const { agency, actorId } = await loadAgencyForEdition(this.teams, this.agencies, command.agencyId, command.actorId);
    const zone = agency.correctZone(ServiceZoneId.of(command.zoneId), ServiceArea.of(command.city, command.district), actorId);
    const events = agency.pullEvents();
    if (events.length > 0) {
      await this.agencies.save(agency);
      await this.events.publish(events);
    }
    return toServiceZoneReadModel(zone);
  }
}
