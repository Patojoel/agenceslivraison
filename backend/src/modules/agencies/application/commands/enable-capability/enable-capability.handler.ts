import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { capabilityTypeOf } from '../../../domain/capability';
import { AGENCY_REPOSITORY, AgencyRepository } from '../../../domain/ports/agency.repository';
import { AGENCY_TEAM_REPOSITORY, AgencyTeamRepository } from '../../../domain/ports/agency-team.repository';
import { toCapabilitiesReadModel } from '../../read-models/capabilities.read-model';
import { loadAgencyForEdition } from '../load-agency-for-edition';
import { EnableCapabilityCommand } from './enable-capability.command';
import { EnableCapabilityResponse } from './enable-capability.response';

@Injectable()
export class EnableCapabilityHandler implements CommandHandler<EnableCapabilityCommand, EnableCapabilityResponse> {
  constructor(
    @Inject(AGENCY_TEAM_REPOSITORY) private readonly teams: AgencyTeamRepository,
    @Inject(AGENCY_REPOSITORY) private readonly agencies: AgencyRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: EnableCapabilityCommand): Promise<EnableCapabilityResponse> {
    const { agency, actorId } = await loadAgencyForEdition(this.teams, this.agencies, command.agencyId, command.actorId);
    agency.enableCapability(capabilityTypeOf(command.capability), actorId, this.clock.now());
    await this.agencies.save(agency);
    await this.events.publish(agency.pullEvents());
    return toCapabilitiesReadModel(agency);
  }
}
