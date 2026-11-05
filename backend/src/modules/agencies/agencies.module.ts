import { Module, OnModuleInit } from '@nestjs/common';
import { IdentityModule } from '@modules/identity/identity.module';
import { InProcessDomainEventPublisher } from '@shared/infrastructure/events/in-process-domain-event-publisher';
import { CreateAgencyHandler } from './application/commands/create-agency/create-agency.handler';
import { AcceptInvitationHandler } from './application/commands/accept-invitation/accept-invitation.handler';
import { ChangeMemberRoleHandler } from './application/commands/change-member-role/change-member-role.handler';
import { IssueInvitationHandler } from './application/commands/issue-invitation/issue-invitation.handler';
import { AddServiceZoneHandler } from './application/commands/add-service-zone/add-service-zone.handler';
import { CreateAgencySiteHandler } from './application/commands/create-agency-site/create-agency-site.handler';
import { DeactivateAgencySiteHandler } from './application/commands/deactivate-agency-site/deactivate-agency-site.handler';
import { EnableCapabilityHandler } from './application/commands/enable-capability/enable-capability.handler';
import { ReactivateAgencySiteHandler } from './application/commands/reactivate-agency-site/reactivate-agency-site.handler';
import { CorrectServiceZoneHandler } from './application/commands/correct-service-zone/correct-service-zone.handler';
import { RetireServiceZoneHandler } from './application/commands/retire-service-zone/retire-service-zone.handler';
import { SuspendCapabilityHandler } from './application/commands/suspend-capability/suspend-capability.handler';
import { SubmitAgencyHandler } from './application/commands/submit-agency/submit-agency.handler';
import { UpdateAgencySiteHandler } from './application/commands/update-agency-site/update-agency-site.handler';
import { UpdateAgencyIdentityHandler } from './application/commands/update-agency-identity/update-agency-identity.handler';
import { UpdateAgencyProfileHandler } from './application/commands/update-agency-profile/update-agency-profile.handler';
import { RevokeMembershipHandler } from './application/commands/revoke-membership/revoke-membership.handler';
import { READ_AGENCY_SITE_REPOSITORY } from './application/ports/read-agency-site.repository';
import { READ_SERVICE_ZONE_REPOSITORY } from './application/ports/read-service-zone.repository';
import { READ_AGENCY_REPOSITORY } from './application/ports/read-agency.repository';
import { READ_AGENCY_ONBOARDING_REPOSITORY } from './application/ports/read-agency-onboarding.repository';
import { READ_AGENCY_MEMBER_REPOSITORY } from './application/ports/read-agency-member.repository';
import { READ_AGENCY_MEMBERSHIP_REPOSITORY } from './application/ports/read-agency-membership.repository';
import { READ_AGENCY_DELIVERY_REPOSITORY } from './application/ports/read-agency-delivery.repository';
import { READ_AGENCY_PUBLIC_VIEW_REPOSITORY } from './application/ports/read-agency-public-view.repository';
import { AgencyAccessReader } from './application/queries/agency-access/agency-access.reader';
import { ListAgencyMembersHandler } from './application/queries/list-agency-members/list-agency-members.handler';
import { GetAgencyHandler } from './application/queries/get-agency/get-agency.handler';
import { GetAgencyOnboardingHandler } from './application/queries/get-agency-onboarding/get-agency-onboarding.handler';
import { ListAgencySitesHandler } from './application/queries/list-agency-sites/list-agency-sites.handler';
import { ListServiceZonesHandler } from './application/queries/list-service-zones/list-service-zones.handler';
import { ListMyAgenciesHandler } from './application/queries/list-my-agencies/list-my-agencies.handler';
import { AgencyAuditSubscriber } from './application/subscribers/agency-audit.subscriber';
import { AGENCY_REPOSITORY } from './domain/ports/agency.repository';
import { AGENCY_TEAM_REPOSITORY } from './domain/ports/agency-team.repository';
import { INVITATION_REPOSITORY } from './domain/ports/invitation.repository';
import { AgencyTypeOrmRepository } from './infrastructure/persistence/typeorm/agency.typeorm.repository';
import { AgencyTeamTypeOrmRepository } from './infrastructure/persistence/typeorm/agency-team.typeorm.repository';
import { InvitationTypeOrmRepository } from './infrastructure/persistence/typeorm/invitation.typeorm.repository';
import { ReadAgencySiteTypeOrmRepository } from './infrastructure/persistence/typeorm/read-agency-site.typeorm.repository';
import { ReadServiceZoneTypeOrmRepository } from './infrastructure/persistence/typeorm/read-service-zone.typeorm.repository';
import { ReadAgencyTypeOrmRepository } from './infrastructure/persistence/typeorm/read-agency.typeorm.repository';
import { ReadAgencyOnboardingTypeOrmRepository } from './infrastructure/persistence/typeorm/read-agency-onboarding.typeorm.repository';
import { ReadAgencyMemberTypeOrmRepository } from './infrastructure/persistence/typeorm/read-agency-member.typeorm.repository';
import { ReadAgencyMembershipTypeOrmRepository } from './infrastructure/persistence/typeorm/read-agency-membership.typeorm.repository';
import { ReadAgencyDeliveryTypeOrmRepository } from './infrastructure/persistence/typeorm/read-agency-delivery.typeorm.repository';
import { ReadAgencyPublicViewTypeOrmRepository } from './infrastructure/persistence/typeorm/read-agency-public-view.typeorm.repository';
import { AgencyCapabilityController } from './presentation/http/agency-capability.controller';
import { AgencySiteController } from './presentation/http/agency-site.controller';
import { AgencyController } from './presentation/http/agency.controller';
import { InvitationController } from './presentation/http/invitation.controller';
import { MembershipController } from './presentation/http/membership.controller';
import { MyAgenciesController } from './presentation/http/my-agencies.controller';
import { ServiceZoneController } from './presentation/http/service-zone.controller';

@Module({
  imports: [IdentityModule],
  controllers: [AgencyController, ServiceZoneController, AgencySiteController, AgencyCapabilityController, MyAgenciesController, MembershipController, InvitationController],
  providers: [
    { provide: AGENCY_REPOSITORY, useClass: AgencyTypeOrmRepository },
    { provide: AGENCY_TEAM_REPOSITORY, useClass: AgencyTeamTypeOrmRepository },
    { provide: INVITATION_REPOSITORY, useClass: InvitationTypeOrmRepository },
    { provide: READ_AGENCY_MEMBERSHIP_REPOSITORY, useClass: ReadAgencyMembershipTypeOrmRepository },
    { provide: READ_AGENCY_MEMBER_REPOSITORY, useClass: ReadAgencyMemberTypeOrmRepository },
    { provide: READ_AGENCY_REPOSITORY, useClass: ReadAgencyTypeOrmRepository },
    { provide: READ_AGENCY_ONBOARDING_REPOSITORY, useClass: ReadAgencyOnboardingTypeOrmRepository },
    { provide: READ_SERVICE_ZONE_REPOSITORY, useClass: ReadServiceZoneTypeOrmRepository },
    { provide: READ_AGENCY_SITE_REPOSITORY, useClass: ReadAgencySiteTypeOrmRepository },
    { provide: READ_AGENCY_DELIVERY_REPOSITORY, useClass: ReadAgencyDeliveryTypeOrmRepository },
    { provide: READ_AGENCY_PUBLIC_VIEW_REPOSITORY, useClass: ReadAgencyPublicViewTypeOrmRepository },
    AgencyAccessReader,
    CreateAgencyHandler,
    UpdateAgencyIdentityHandler,
    UpdateAgencyProfileHandler,
    SubmitAgencyHandler,
    AddServiceZoneHandler,
    RetireServiceZoneHandler,
    CorrectServiceZoneHandler,
    CreateAgencySiteHandler,
    UpdateAgencySiteHandler,
    DeactivateAgencySiteHandler,
    ReactivateAgencySiteHandler,
    EnableCapabilityHandler,
    SuspendCapabilityHandler,
    ListServiceZonesHandler,
    ListAgencySitesHandler,
    GetAgencyHandler,
    GetAgencyOnboardingHandler,
    ChangeMemberRoleHandler,
    RevokeMembershipHandler,
    IssueInvitationHandler,
    AcceptInvitationHandler,
    ListMyAgenciesHandler,
    ListAgencyMembersHandler,
    AgencyAuditSubscriber,
  ],
  /** What other modules may read of an agency; they never reach its tables, repositories or handlers. */
  exports: [AgencyAccessReader],
})
export class AgenciesModule implements OnModuleInit {
  constructor(private readonly publisher: InProcessDomainEventPublisher, private readonly audit: AgencyAuditSubscriber) {}

  onModuleInit(): void {
    this.publisher.subscribe(this.audit);
  }
}
