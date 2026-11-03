import { Module, OnModuleInit } from '@nestjs/common';
import { InProcessDomainEventPublisher } from '@shared/infrastructure/events/in-process-domain-event-publisher';
import { LoginHandler } from './application/commands/login/login.handler';
import { LogoutHandler } from './application/commands/logout/logout.handler';
import { RefreshSessionHandler } from './application/commands/refresh-session/refresh-session.handler';
import { RegisterUserHandler } from './application/commands/register-user/register-user.handler';
import { ACCESS_TOKENS } from './application/ports/access-tokens.port';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port';
import { READ_SESSION_REPOSITORY } from './application/ports/read-session.repository';
import { AuthenticateHandler } from './application/queries/authenticate/authenticate.handler';
import { IdentityAuditSubscriber } from './application/subscribers/identity-audit.subscriber';
import { SESSION_REPOSITORY } from './domain/ports/session.repository';
import { USER_REPOSITORY } from './domain/ports/user.repository';
import { Argon2PasswordHasher } from './infrastructure/crypto/argon2-password-hasher';
import { JwtAccessTokens } from './infrastructure/jwt/jwt-access-tokens';
import { ReadSessionTypeOrmRepository } from './infrastructure/persistence/typeorm/read-session.typeorm.repository';
import { SessionTypeOrmRepository } from './infrastructure/persistence/typeorm/session.typeorm.repository';
import { UserTypeOrmRepository } from './infrastructure/persistence/typeorm/user.typeorm.repository';
import { AuthController } from './presentation/http/auth.controller';
import { AccessTokenGuard } from './presentation/http/guards/access-token.guard';
import { MeController } from './presentation/http/me.controller';

/** Exposes `AccessTokenGuard` (and the handler behind it) to the modules that protect their routes. */
@Module({
  controllers: [AuthController, MeController],
  providers: [
    { provide: USER_REPOSITORY, useClass: UserTypeOrmRepository },
    { provide: SESSION_REPOSITORY, useClass: SessionTypeOrmRepository },
    { provide: READ_SESSION_REPOSITORY, useClass: ReadSessionTypeOrmRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: ACCESS_TOKENS, useClass: JwtAccessTokens },
    RegisterUserHandler,
    LoginHandler,
    RefreshSessionHandler,
    LogoutHandler,
    AuthenticateHandler,
    IdentityAuditSubscriber,
    AccessTokenGuard,
  ],
  exports: [AuthenticateHandler, AccessTokenGuard],
})
export class IdentityModule implements OnModuleInit {
  constructor(private readonly publisher: InProcessDomainEventPublisher, private readonly audit: IdentityAuditSubscriber) {}

  onModuleInit(): void {
    this.publisher.subscribe(this.audit);
  }
}
