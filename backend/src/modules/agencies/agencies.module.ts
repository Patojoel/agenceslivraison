import { Module, OnModuleInit } from '@nestjs/common';
import { IdentityModule } from '@modules/identity/identity.module';
import { InProcessDomainEventPublisher } from '@shared/infrastructure/events/in-process-domain-event-publisher';
import { CreateAgencyHandler } from './application/commands/create-agency/create-agency.handler';
import { AcceptInvitationHandler } from './application/commands/accept-invitation/accept-invitation.handler';
import { ChangeMemberRoleHandler } from './application/commands/change-member-role/change-member-role.handler';
import { IssueInvitationHandler } from './application/commands/issue-invitation/issue-invitation.handler';
import { RevokeMembershipHandler } from './application/commands/revoke-membership/revoke-membership.handler';
import { READ_AGENCY_ONBOARDING_REPOSITORY } from './application/ports/read-agency-onboarding.repository';
import { READ_AGENCY_MEMBERSHIP_REPOSITORY } from './application/ports/read-agency-membership.repository';
import { GetAgencyOnboardingHandler } from './application/queries/get-agency-onboarding/get-agency-onboarding.handler';
import { ListMyAgenciesHandler } from './application/queries/list-my-agencies/list-my-agencies.handler';
import { AgencyAuditSubscriber } from './application/subscribers/agency-audit.subscriber';
import { AGENCY_REPOSITORY } from './domain/ports/agency.repository';
import { AGENCY_TEAM_REPOSITORY } from './domain/ports/agency-team.repository';
import { INVITATION_REPOSITORY } from './domain/ports/invitation.repository';
import { AgencyTypeOrmRepository } from './infrastructure/persistence/typeorm/agency.typeorm.repository';
import { AgencyTeamTypeOrmRepository } from './infrastructure/persistence/typeorm/agency-team.typeorm.repository';
import { InvitationTypeOrmRepository } from './infrastructure/persistence/typeorm/invitation.typeorm.repository';
import { ReadAgencyOnboardingTypeOrmRepository } from './infrastructure/persistence/typeorm/read-agency-onboarding.typeorm.repository';
import { ReadAgencyMembershipTypeOrmRepository } from './infrastructure/persistence/typeorm/read-agency-membership.typeorm.repository';
import { AgencyController } from './presentation/http/agency.controller';
import { InvitationController } from './presentation/http/invitation.controller';
import { MembershipController } from './presentation/http/membership.controller';
import { MyAgenciesController } from './presentation/http/my-agencies.controller';

@Module({
  imports: [IdentityModule],
  controllers: [AgencyController, MyAgenciesController, MembershipController, InvitationController],
  providers: [
    { provide: AGENCY_REPOSITORY, useClass: AgencyTypeOrmRepository },
    { provide: AGENCY_TEAM_REPOSITORY, useClass: AgencyTeamTypeOrmRepository },
    { provide: INVITATION_REPOSITORY, useClass: InvitationTypeOrmRepository },
    { provide: READ_AGENCY_MEMBERSHIP_REPOSITORY, useClass: ReadAgencyMembershipTypeOrmRepository },
    { provide: READ_AGENCY_ONBOARDING_REPOSITORY, useClass: ReadAgencyOnboardingTypeOrmRepository },
    CreateAgencyHandler,
    GetAgencyOnboardingHandler,
    ChangeMemberRoleHandler,
    RevokeMembershipHandler,
    IssueInvitationHandler,
    AcceptInvitationHandler,
    ListMyAgenciesHandler,
    AgencyAuditSubscriber,
  ],
})
export class AgenciesModule implements OnModuleInit {
  constructor(private readonly publisher: InProcessDomainEventPublisher, private readonly audit: AgencyAuditSubscriber) {}

  onModuleInit(): void {
    this.publisher.subscribe(this.audit);
  }
}
