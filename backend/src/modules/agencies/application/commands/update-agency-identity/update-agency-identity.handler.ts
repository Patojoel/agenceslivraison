import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { UserId } from '@shared/domain/value-objects/user-id';
import { identityChangeOf } from '../../../domain/agency-identity';
import { AgencyNotFound } from '../../../domain/exceptions/agency.exceptions';
import { AGENCY_REPOSITORY, AgencyRepository } from '../../../domain/ports/agency.repository';
import { AGENCY_TEAM_REPOSITORY, AgencyTeamRepository } from '../../../domain/ports/agency-team.repository';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { UpdateAgencyIdentityCommand } from './update-agency-identity.command';
import { UpdateAgencyIdentityResponse } from './update-agency-identity.response';

@Injectable()
export class UpdateAgencyIdentityHandler implements CommandHandler<UpdateAgencyIdentityCommand, UpdateAgencyIdentityResponse> {
  constructor(
    @Inject(AGENCY_TEAM_REPOSITORY) private readonly teams: AgencyTeamRepository,
    @Inject(AGENCY_REPOSITORY) private readonly agencies: AgencyRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  /** The team is loaded first, under the agency row lock: it decides who may act and serializes concurrent edits. Only the agency is written. */
  async handle(command: UpdateAgencyIdentityCommand): Promise<UpdateAgencyIdentityResponse> {
    const agencyId = AgencyId.of(command.agencyId);
    const actorId = UserId.of(command.actorId);
    const team = await this.teams.lockAndLoad(agencyId);
    team.authorizeAgencyEdition(actorId);
    const agency = await this.agencies.findById(agencyId);
    if (!agency) throw new AgencyNotFound();
    agency.completeIdentity(identityChangeOf(command.changes), actorId, command.expectedVersion);
    const events = agency.pullEvents();
    if (events.length > 0) {
      await this.agencies.save(agency);
      await this.events.publish(events);
    }
    const { version, identity } = agency.snapshot();
    return {
      version,
      identity: {
        legalName: identity.legalName?.value ?? null,
        headquartersCity: identity.headquartersCity?.value ?? null,
        headquartersAddress: identity.headquartersAddress?.value ?? null,
        primaryPhone: identity.primaryPhone?.value ?? null,
        contactEmail: identity.contactEmail?.value ?? null,
        rccm: identity.rccm?.value ?? null,
        niu: identity.niu?.value ?? null,
      },
    };
  }
}
