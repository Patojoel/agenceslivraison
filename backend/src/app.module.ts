import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { createDatabase } from './database';
import { DATABASE_POOL, HealthController } from './health.controller';
import { AgenciesController } from './modules/agencies/infrastructure/http/agencies.controller';
import { InvitationController } from './modules/identity/infrastructure/http/invitation.controller';
import { MembershipController } from './modules/identity/infrastructure/http/membership.controller';
import { SessionController } from './modules/identity/infrastructure/http/session.controller';
import { LoginController } from './modules/identity/infrastructure/http/login.controller';
import { RegistrationController } from './modules/identity/infrastructure/http/registration.controller';
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])],
  controllers: [HealthController, RegistrationController, LoginController, SessionController, MembershipController, InvitationController, AgenciesController],
  providers: [{ provide: DATABASE_POOL, useFactory: () => createDatabase().pool }, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
