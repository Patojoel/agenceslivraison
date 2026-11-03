import { Module } from '@nestjs/common';
import { SQL_READER, SqlReader } from '../../shared/application/ports/sql-reader';
import { IdentityModule } from '../identity/identity.module';
import { ListMyAgenciesQueryHandler } from './application/queries/list-my-agencies/list-my-agencies.query-handler';
import { InvitationController } from './infrastructure/http/invitation.controller';
import { MembershipController } from './infrastructure/http/membership.controller';
import { MyAgenciesController } from './infrastructure/http/my-agencies.controller';

@Module({
  imports: [IdentityModule],
  controllers: [MyAgenciesController, MembershipController, InvitationController],
  providers: [
    { provide: ListMyAgenciesQueryHandler, useFactory: (reader: SqlReader) => new ListMyAgenciesQueryHandler(reader), inject: [SQL_READER] },
  ],
})
export class AgenciesModule {}
