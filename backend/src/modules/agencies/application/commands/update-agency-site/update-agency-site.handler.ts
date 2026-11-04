import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { siteChangeOf } from '../../../domain/agency-site';
import { AGENCY_REPOSITORY, AgencyRepository } from '../../../domain/ports/agency.repository';
import { AGENCY_TEAM_REPOSITORY, AgencyTeamRepository } from '../../../domain/ports/agency-team.repository';
import { AgencySiteId } from '../../../domain/value-objects/agency-site-id';
import { toAgencySiteReadModel } from '../../read-models/agency-site.read-model';
import { loadAgencyForEdition } from '../load-agency-for-edition';
import { UpdateAgencySiteCommand } from './update-agency-site.command';
import { UpdateAgencySiteResponse } from './update-agency-site.response';

@Injectable()
export class UpdateAgencySiteHandler implements CommandHandler<UpdateAgencySiteCommand, UpdateAgencySiteResponse> {
  constructor(
    @Inject(AGENCY_TEAM_REPOSITORY) private readonly teams: AgencyTeamRepository,
    @Inject(AGENCY_REPOSITORY) private readonly agencies: AgencyRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: UpdateAgencySiteCommand): Promise<UpdateAgencySiteResponse> {
    const { agency, actorId } = await loadAgencyForEdition(this.teams, this.agencies, command.agencyId, command.actorId);
    const site = agency.updateSite(AgencySiteId.of(command.siteId), siteChangeOf(command.changes), actorId, command.expectedVersion);
    const events = agency.pullEvents();
    if (events.length > 0) {
      await this.agencies.save(agency);
      await this.events.publish(events);
    }
    return toAgencySiteReadModel(site);
  }
}
