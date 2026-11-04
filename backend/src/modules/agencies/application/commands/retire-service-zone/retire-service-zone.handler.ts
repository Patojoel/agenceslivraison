import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { AGENCY_REPOSITORY, AgencyRepository } from '../../../domain/ports/agency.repository';
import { AGENCY_TEAM_REPOSITORY, AgencyTeamRepository } from '../../../domain/ports/agency-team.repository';
import { ServiceZoneId } from '../../../domain/value-objects/service-zone-id';
import { toServiceZoneReadModel } from '../../read-models/service-zone.read-model';
import { loadAgencyForEdition } from '../load-agency-for-edition';
import { RetireServiceZoneCommand } from './retire-service-zone.command';
import { RetireServiceZoneResponse } from './retire-service-zone.response';

@Injectable()
export class RetireServiceZoneHandler implements CommandHandler<RetireServiceZoneCommand, RetireServiceZoneResponse> {
  constructor(
    @Inject(AGENCY_TEAM_REPOSITORY) private readonly teams: AgencyTeamRepository,
    @Inject(AGENCY_REPOSITORY) private readonly agencies: AgencyRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: RetireServiceZoneCommand): Promise<RetireServiceZoneResponse> {
    const { agency, actorId } = await loadAgencyForEdition(this.teams, this.agencies, command.agencyId, command.actorId);
    const zone = agency.retireZone(ServiceZoneId.of(command.zoneId), actorId, this.clock.now());
    await this.agencies.save(agency);
    await this.events.publish(agency.pullEvents());
    return toServiceZoneReadModel(zone);
  }
}
