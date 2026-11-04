import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { UserId } from '@shared/domain/value-objects/user-id';
import { profileChangeOf } from '../../../domain/agency-identity';
import { AgencyNotFound } from '../../../domain/exceptions/agency.exceptions';
import { AGENCY_REPOSITORY, AgencyRepository } from '../../../domain/ports/agency.repository';
import { AGENCY_TEAM_REPOSITORY, AgencyTeamRepository } from '../../../domain/ports/agency-team.repository';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { lockTeamForActor } from '../lock-team';
import { UpdateAgencyProfileCommand } from './update-agency-profile.command';
import { UpdateAgencyProfileResponse } from './update-agency-profile.response';

@Injectable()
export class UpdateAgencyProfileHandler implements CommandHandler<UpdateAgencyProfileCommand, UpdateAgencyProfileResponse> {
  constructor(
    @Inject(AGENCY_TEAM_REPOSITORY) private readonly teams: AgencyTeamRepository,
    @Inject(AGENCY_REPOSITORY) private readonly agencies: AgencyRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  /** Same protocol as the identity: the team under lock decides who may act, then only the agency is written. */
  async handle(command: UpdateAgencyProfileCommand): Promise<UpdateAgencyProfileResponse> {
    const agencyId = AgencyId.of(command.agencyId);
    const actorId = UserId.of(command.actorId);
    const team = await lockTeamForActor(this.teams, agencyId, actorId, (loaded, actor) => loaded.authorizeAgencyEdition(actor));
    team.authorizeAgencyEdition(actorId);
    const agency = await this.agencies.findById(agencyId);
    if (!agency) throw new AgencyNotFound();
    agency.updateProfile(profileChangeOf(command.changes), actorId, command.expectedVersion);
    const events = agency.pullEvents();
    if (events.length > 0) {
      await this.agencies.save(agency);
      await this.events.publish(events);
    }
    const { version, tradeName, description } = agency.snapshot();
    return { version, tradeName: tradeName.value, description: description?.value ?? null };
  }
}
