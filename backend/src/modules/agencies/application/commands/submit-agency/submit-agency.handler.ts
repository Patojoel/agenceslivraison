import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler } from '@shared/application/command-handler';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '@shared/application/ports/domain-event-publisher.port';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { AGENCY_REPOSITORY, AgencyRepository } from '../../../domain/ports/agency.repository';
import { AGENCY_TEAM_REPOSITORY, AgencyTeamRepository } from '../../../domain/ports/agency-team.repository';
import { loadAgencyForEdition } from '../load-agency-for-edition';
import { SubmitAgencyCommand } from './submit-agency.command';
import { SubmitAgencyResponse } from './submit-agency.response';

@Injectable()
export class SubmitAgencyHandler implements CommandHandler<SubmitAgencyCommand, SubmitAgencyResponse> {
  constructor(
    @Inject(AGENCY_TEAM_REPOSITORY) private readonly teams: AgencyTeamRepository,
    @Inject(AGENCY_REPOSITORY) private readonly agencies: AgencyRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly events: DomainEventPublisher,
  ) {}

  async handle(command: SubmitAgencyCommand): Promise<SubmitAgencyResponse> {
    const { agency, actorId } = await loadAgencyForEdition(this.teams, this.agencies, command.agencyId, command.actorId, (team, actor) => team.authorizeAgencySubmission(actor));
    agency.submit(actorId, this.clock.now());
    await this.agencies.save(agency);
    await this.events.publish(agency.pullEvents());
    const { submission } = agency.snapshot();
    if (!submission) throw new Error('A submitted agency has its submission');
    return { status: 'submitted', submission: { submittedAt: submission.at.toISOString(), submittedBy: submission.by.value } };
  }
}
