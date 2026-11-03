import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { InvitationController } from './modules/identity/infrastructure/http/invitation.controller';
import { MembershipController } from './modules/identity/infrastructure/http/membership.controller';
import { SessionController } from './modules/identity/infrastructure/http/session.controller';
import { LoginController } from './modules/identity/infrastructure/http/login.controller';
import { RegistrationController } from './modules/identity/infrastructure/http/registration.controller';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]), SharedModule],
  controllers: [RegistrationController, LoginController, SessionController, MembershipController, InvitationController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
