import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { UUID_GENERATOR, UuidGenerator } from '@shared/domain/ports/uuid-generator.port';
import { siteDetailsOf } from '../../../domain/agency-site';
import { AGENCY_REPOSITORY, AgencyRepository } from '../../../domain/ports/agency.repository';
import { AGENCY_TEAM_REPOSITORY, AgencyTeamRepository } from '../../../domain/ports/agency-team.repository';
import { AgencySiteId } from '../../../domain/value-objects/agency-site-id';
import { toAgencySiteReadModel } from '../../read-models/agency-site.read-model';
import { loadAgencyForEdition } from '../load-agency-for-edition';
import { CreateAgencySiteCommand } from './create-agency-site.command';
import { CreateAgencySiteResponse } from './create-agency-site.response';

@Injectable()
export class CreateAgencySiteHandler implements CommandHandler<CreateAgencySiteCommand, CreateAgencySiteResponse> {
  constructor(
    @Inject(AGENCY_TEAM_REPOSITORY) private readonly teams: AgencyTeamRepository,
    @Inject(AGENCY_REPOSITORY) private readonly agencies: AgencyRepository,
    @Inject(UUID_GENERATOR) private readonly uuid: UuidGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: CreateAgencySiteCommand): Promise<CreateAgencySiteResponse> {
    const { agency, actorId } = await loadAgencyForEdition(this.teams, this.agencies, command.agencyId, command.actorId);
    const site = agency.createSite(AgencySiteId.of(this.uuid.generate()), siteDetailsOf(command), actorId, this.clock.now());
    await this.agencies.save(agency);
    await this.events.publish(agency.pullEvents());
    return toAgencySiteReadModel(site);
  }
}
