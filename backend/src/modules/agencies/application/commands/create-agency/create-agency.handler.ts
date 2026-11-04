import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { IDEMPOTENCY_KEYS, IdempotencyKeys } from '@shared/application/ports/idempotency-keys.port';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { UUID_GENERATOR, UuidGenerator } from '@shared/domain/ports/uuid-generator.port';
import { UserId } from '@shared/domain/value-objects/user-id';
import { Agency } from '../../../domain/agency';
import { AgencyTeam } from '../../../domain/agency-team';
import { IdempotencyKeyReused } from '../../../domain/exceptions/agency.exceptions';
import { AGENCY_REPOSITORY, AgencyRepository } from '../../../domain/ports/agency.repository';
import { AGENCY_TEAM_REPOSITORY, AgencyTeamRepository } from '../../../domain/ports/agency-team.repository';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { MembershipId } from '../../../domain/value-objects/membership-id';
import { TradeName } from '../../../domain/value-objects/trade-name';
import { CreateAgencyCommand } from './create-agency.command';
import { CreateAgencyResponse } from './create-agency.response';

const SCOPE = 'agency.create';

/**
 * Deliberately writes two aggregates in one transaction (see docs/domains.md): an agency without an
 * owner could not be managed by anyone, so neither may exist without the other.
 */
@Injectable()
export class CreateAgencyHandler implements CommandHandler<CreateAgencyCommand, CreateAgencyResponse> {
  constructor(
    @Inject(AGENCY_REPOSITORY) private readonly agencies: AgencyRepository,
    @Inject(AGENCY_TEAM_REPOSITORY) private readonly teams: AgencyTeamRepository,
    @Inject(IDEMPOTENCY_KEYS) private readonly idempotency: IdempotencyKeys,
    @Inject(UUID_GENERATOR) private readonly uuid: UuidGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: CreateAgencyCommand): Promise<CreateAgencyResponse> {
    const actorId = UserId.of(command.actorId);
    const tradeName = TradeName.of(command.tradeName);
    const agencyId = AgencyId.of(this.uuid.generate());
    if (command.idempotencyKey !== null) {
      const claim = await this.idempotency.claim({
        actorId: actorId.value, scope: SCOPE, key: command.idempotencyKey, fingerprint: tradeName.value, resourceId: agencyId.value,
      });
      if (claim.kind === 'mismatch') throw new IdempotencyKeyReused();
      if (claim.kind === 'replayed') return created(claim.resourceId, tradeName);
    }
    const agency = Agency.draft({ id: agencyId, tradeName, createdBy: actorId }, this.clock.now());
    await this.agencies.add(agency);
    await this.teams.save(AgencyTeam.found(agencyId, MembershipId.of(this.uuid.generate()), actorId));
    await this.events.publish(agency.pullEvents());
    return created(agencyId.value, tradeName);
  }
}

function created(agencyId: string, tradeName: TradeName): CreateAgencyResponse {
  return { agencyId, tradeName: tradeName.value, status: 'draft', role: 'owner' };
}
