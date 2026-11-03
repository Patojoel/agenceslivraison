import { Module, OnModuleInit } from '@nestjs/common';
import { AUDIT_LOG, AuditLog } from '../../shared/application/ports/audit-log';
import { CLOCK, Clock } from '../../shared/application/ports/clock';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '../../shared/application/ports/domain-events';
import { ID_GENERATOR, IdGenerator } from '../../shared/application/ports/id-generator';
import { SQL_READER, SqlReader } from '../../shared/application/ports/sql-reader';
import { TOKEN_SECRETS, TokenSecrets } from '../../shared/application/ports/token-secrets';
import { Database } from '../../shared/infrastructure/db/database';
import { InProcessDomainEventPublisher } from '../../shared/infrastructure/events/in-process-domain-event-publisher';
import { LoginHandler } from './application/command/login/login.handler';
import { LogoutHandler } from './application/command/logout/logout.handler';
import { RefreshSessionHandler } from './application/command/refresh-session/refresh-session.handler';
import { RegisterUserHandler } from './application/command/register-user/register-user.handler';
import { ACCESS_TOKENS, AccessTokens } from './application/ports/access-tokens';
import { PASSWORD_HASHER, PasswordHasher } from './application/ports/password-hasher';
import { AuthenticateQueryHandler } from './application/queries/authenticate/authenticate.query-handler';
import { IdentityAuditSubscriber } from './application/subscribers/identity-audit.subscriber';
import { SESSION_REPOSITORY, SessionRepository } from './domain/repositories/session.repository';
import { USER_REPOSITORY, UserRepository } from './domain/repositories/user.repository';
import { Argon2PasswordHasher } from './infrastructure/adapters/argon2-password-hasher';
import { JwtAccessTokens } from './infrastructure/adapters/jwt-access-tokens';
import { LoginController } from './infrastructure/http/login.controller';
import { RegistrationController } from './infrastructure/http/registration.controller';
import { SessionController } from './infrastructure/http/session.controller';
import { PgSessionRepository } from './infrastructure/persistence/pg-session.repository';
import { PgUserRepository } from './infrastructure/persistence/pg-user.repository';
import { AccessTokenGuard } from './infrastructure/security/access-token.guard';

@Module({
  controllers: [RegistrationController, LoginController, SessionController],
  providers: [
    { provide: USER_REPOSITORY, useFactory: (database: Database) => new PgUserRepository(database), inject: [Database] },
    { provide: SESSION_REPOSITORY, useFactory: (database: Database) => new PgSessionRepository(database), inject: [Database] },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: ACCESS_TOKENS, useClass: JwtAccessTokens },
    {
      provide: RegisterUserHandler,
      useFactory: (users: UserRepository, hasher: PasswordHasher, ids: IdGenerator, events: DomainEventPublisher) => new RegisterUserHandler(users, hasher, ids, events),
      inject: [USER_REPOSITORY, PASSWORD_HASHER, ID_GENERATOR, DOMAIN_EVENT_PUBLISHER],
    },
    {
      provide: LoginHandler,
      useFactory: (users: UserRepository, sessions: SessionRepository, hasher: PasswordHasher, tokens: AccessTokens, secrets: TokenSecrets, ids: IdGenerator, clock: Clock, events: DomainEventPublisher) =>
        new LoginHandler(users, sessions, hasher, tokens, secrets, ids, clock, events),
      inject: [USER_REPOSITORY, SESSION_REPOSITORY, PASSWORD_HASHER, ACCESS_TOKENS, TOKEN_SECRETS, ID_GENERATOR, CLOCK, DOMAIN_EVENT_PUBLISHER],
    },
    {
      provide: RefreshSessionHandler,
      useFactory: (sessions: SessionRepository, tokens: AccessTokens, secrets: TokenSecrets, clock: Clock, events: DomainEventPublisher) => new RefreshSessionHandler(sessions, tokens, secrets, clock, events),
      inject: [SESSION_REPOSITORY, ACCESS_TOKENS, TOKEN_SECRETS, CLOCK, DOMAIN_EVENT_PUBLISHER],
    },
    {
      provide: LogoutHandler,
      useFactory: (sessions: SessionRepository, secrets: TokenSecrets, clock: Clock, events: DomainEventPublisher) => new LogoutHandler(sessions, secrets, clock, events),
      inject: [SESSION_REPOSITORY, TOKEN_SECRETS, CLOCK, DOMAIN_EVENT_PUBLISHER],
    },
    {
      provide: AuthenticateQueryHandler,
      useFactory: (tokens: AccessTokens, reader: SqlReader, clock: Clock) => new AuthenticateQueryHandler(tokens, reader, clock),
      inject: [ACCESS_TOKENS, SQL_READER, CLOCK],
    },
    { provide: IdentityAuditSubscriber, useFactory: (audit: AuditLog) => new IdentityAuditSubscriber(audit), inject: [AUDIT_LOG] },
    AccessTokenGuard,
  ],
  exports: [AuthenticateQueryHandler, AccessTokenGuard],
})
export class IdentityModule implements OnModuleInit {
  constructor(private readonly publisher: InProcessDomainEventPublisher, private readonly audit: IdentityAuditSubscriber) {}

  onModuleInit(): void {
    this.publisher.subscribe(this.audit);
  }
}
