import { Module, OnModuleInit } from '@nestjs/common';
import { AUDIT_LOG, AuditLog } from '../../shared/application/ports/audit-log';
import { CLOCK, Clock } from '../../shared/application/ports/clock';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '../../shared/application/ports/domain-events';
import { ID_GENERATOR, IdGenerator } from '../../shared/application/ports/id-generator';
import { SQL_READER, SqlReader } from '../../shared/application/ports/sql-reader';
import { TOKEN_SECRETS, TokenSecrets } from '../../shared/application/ports/token-secrets';
import { Database } from '../../shared/infrastructure/db/database';
import { InProcessDomainEventPublisher } from '../../shared/infrastructure/events/in-process-domain-event-publisher';
import { IdentityModule } from '../identity/identity.module';
import { AcceptInvitationHandler } from './application/command/accept-invitation/accept-invitation.handler';
import { ChangeMemberRoleHandler } from './application/command/change-member-role/change-member-role.handler';
import { IssueInvitationHandler } from './application/command/issue-invitation/issue-invitation.handler';
import { RevokeMembershipHandler } from './application/command/revoke-membership/revoke-membership.handler';
import { ListMyAgenciesQueryHandler } from './application/queries/list-my-agencies/list-my-agencies.query-handler';
import { AgencyAuditSubscriber } from './application/subscribers/agency-audit.subscriber';
import { AGENCY_TEAM_REPOSITORY, AgencyTeamRepository } from './domain/repositories/agency-team.repository';
import { INVITATION_REPOSITORY, InvitationRepository } from './domain/repositories/invitation.repository';
import { InvitationController } from './infrastructure/http/invitation.controller';
import { MembershipController } from './infrastructure/http/membership.controller';
import { MyAgenciesController } from './infrastructure/http/my-agencies.controller';
import { PgAgencyTeamRepository } from './infrastructure/persistence/pg-agency-team.repository';
import { PgInvitationRepository } from './infrastructure/persistence/pg-invitation.repository';

@Module({
  imports: [IdentityModule],
  controllers: [MyAgenciesController, MembershipController, InvitationController],
  providers: [
    { provide: AGENCY_TEAM_REPOSITORY, useFactory: (database: Database) => new PgAgencyTeamRepository(database), inject: [Database] },
    { provide: INVITATION_REPOSITORY, useFactory: (database: Database) => new PgInvitationRepository(database), inject: [Database] },
    {
      provide: ChangeMemberRoleHandler,
      useFactory: (teams: AgencyTeamRepository, events: DomainEventPublisher) => new ChangeMemberRoleHandler(teams, events),
      inject: [AGENCY_TEAM_REPOSITORY, DOMAIN_EVENT_PUBLISHER],
    },
    {
      provide: RevokeMembershipHandler,
      useFactory: (teams: AgencyTeamRepository, events: DomainEventPublisher) => new RevokeMembershipHandler(teams, events),
      inject: [AGENCY_TEAM_REPOSITORY, DOMAIN_EVENT_PUBLISHER],
    },
    {
      provide: IssueInvitationHandler,
      useFactory: (teams: AgencyTeamRepository, invitations: InvitationRepository, secrets: TokenSecrets, ids: IdGenerator, clock: Clock, events: DomainEventPublisher) =>
        new IssueInvitationHandler(teams, invitations, secrets, ids, clock, events),
      inject: [AGENCY_TEAM_REPOSITORY, INVITATION_REPOSITORY, TOKEN_SECRETS, ID_GENERATOR, CLOCK, DOMAIN_EVENT_PUBLISHER],
    },
    {
      provide: AcceptInvitationHandler,
      useFactory: (invitations: InvitationRepository, teams: AgencyTeamRepository, secrets: TokenSecrets, ids: IdGenerator, clock: Clock, events: DomainEventPublisher) =>
        new AcceptInvitationHandler(invitations, teams, secrets, ids, clock, events),
      inject: [INVITATION_REPOSITORY, AGENCY_TEAM_REPOSITORY, TOKEN_SECRETS, ID_GENERATOR, CLOCK, DOMAIN_EVENT_PUBLISHER],
    },
    { provide: ListMyAgenciesQueryHandler, useFactory: (reader: SqlReader) => new ListMyAgenciesQueryHandler(reader), inject: [SQL_READER] },
    { provide: AgencyAuditSubscriber, useFactory: (audit: AuditLog) => new AgencyAuditSubscriber(audit), inject: [AUDIT_LOG] },
  ],
})
export class AgenciesModule implements OnModuleInit {
  constructor(private readonly publisher: InProcessDomainEventPublisher, private readonly audit: AgencyAuditSubscriber) {}

  onModuleInit(): void {
    this.publisher.subscribe(this.audit);
  }
}
