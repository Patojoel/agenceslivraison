import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { AGENCY_REPOSITORY, AgencyRepository } from '../../../domain/ports/agency.repository';
import { AGENCY_TEAM_REPOSITORY, AgencyTeamRepository } from '../../../domain/ports/agency-team.repository';
import { AgencySiteId } from '../../../domain/value-objects/agency-site-id';
import { toAgencySiteReadModel } from '../../read-models/agency-site.read-model';
import { loadAgencyForEdition } from '../load-agency-for-edition';
import { ReactivateAgencySiteCommand } from './reactivate-agency-site.command';
import { ReactivateAgencySiteResponse } from './reactivate-agency-site.response';

@Injectable()
export class ReactivateAgencySiteHandler implements CommandHandler<ReactivateAgencySiteCommand, ReactivateAgencySiteResponse> {
  constructor(
    @Inject(AGENCY_TEAM_REPOSITORY) private readonly teams: AgencyTeamRepository,
    @Inject(AGENCY_REPOSITORY) private readonly agencies: AgencyRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: ReactivateAgencySiteCommand): Promise<ReactivateAgencySiteResponse> {
    const { agency, actorId } = await loadAgencyForEdition(this.teams, this.agencies, command.agencyId, command.actorId);
    const site = agency.reactivateSite(AgencySiteId.of(command.siteId), actorId);
    await this.agencies.save(agency);
    await this.events.publish(agency.pullEvents());
    return toAgencySiteReadModel(site);
  }
}
