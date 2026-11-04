import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { capabilityTypeOf } from '../../../domain/capability';
import { AGENCY_REPOSITORY, AgencyRepository } from '../../../domain/ports/agency.repository';
import { AGENCY_TEAM_REPOSITORY, AgencyTeamRepository } from '../../../domain/ports/agency-team.repository';
import { SuspensionReason } from '../../../domain/value-objects/suspension-reason';
import { toCapabilitiesReadModel } from '../../read-models/capabilities.read-model';
import { loadAgencyForEdition } from '../load-agency-for-edition';
import { SuspendCapabilityCommand } from './suspend-capability.command';
import { SuspendCapabilityResponse } from './suspend-capability.response';

@Injectable()
export class SuspendCapabilityHandler implements CommandHandler<SuspendCapabilityCommand, SuspendCapabilityResponse> {
  constructor(
    @Inject(AGENCY_TEAM_REPOSITORY) private readonly teams: AgencyTeamRepository,
    @Inject(AGENCY_REPOSITORY) private readonly agencies: AgencyRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: SuspendCapabilityCommand): Promise<SuspendCapabilityResponse> {
    const { agency, actorId } = await loadAgencyForEdition(this.teams, this.agencies, command.agencyId, command.actorId);
    agency.suspendCapability(capabilityTypeOf(command.capability), SuspensionReason.of(command.reason), actorId, this.clock.now());
    await this.agencies.save(agency);
    await this.events.publish(agency.pullEvents());
    return toCapabilitiesReadModel(agency);
  }
}
