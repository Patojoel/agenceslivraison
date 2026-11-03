import { Body, Controller, Delete, Header, HttpCode, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CommandHandler } from '../../../../shared/application/command-handler';
import { TransactionalCommandHandlerFactory } from '../../../../shared/infrastructure/db/transactional-command-handler.factory';
import { parseRequest, uuidParam } from '../../../../shared/infrastructure/http/parse-request';
import { AuthenticatedUser } from '../../../identity/application/queries/authenticate/authenticated-user';
import { AccessTokenGuard } from '../../../identity/infrastructure/security/access-token.guard';
import { CurrentUser } from '../../../identity/infrastructure/security/current-user.decorator';
import { ChangeMemberRoleCommand } from '../../application/command/change-member-role/change-member-role.command';
import { ChangeMemberRoleHandler } from '../../application/command/change-member-role/change-member-role.handler';
import { RevokeMembershipCommand } from '../../application/command/revoke-membership/revoke-membership.command';
import { RevokeMembershipHandler } from '../../application/command/revoke-membership/revoke-membership.handler';
import { changeMemberRoleRequest } from './requests/agency.requests';

@ApiTags('agency-members')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('agencies/:agencyId/members')
export class MembershipController {
  private readonly changeRole: CommandHandler<ChangeMemberRoleCommand, { success: true }>;
  private readonly revokeMembership: CommandHandler<RevokeMembershipCommand, { success: true }>;

  constructor(changeRole: ChangeMemberRoleHandler, revoke: RevokeMembershipHandler, transactional: TransactionalCommandHandlerFactory) {
    this.changeRole = transactional.create(changeRole);
    this.revokeMembership = transactional.create(revoke);
  }

  @Patch(':memberId')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ schema: { type: 'object', required: ['role'], properties: { role: { type: 'string', enum: ['owner', 'admin', 'agent'] } } } })
  @ApiOkResponse({ description: 'Rôle modifié.' })
  change(@CurrentUser() user: AuthenticatedUser, @Param('agencyId') agencyId: string, @Param('memberId') memberId: string, @Body() body: unknown): Promise<{ success: true }> {
    const membershipId = parseRequest(uuidParam, memberId);
    const { role } = parseRequest(changeMemberRoleRequest, body);
    return this.changeRole.handle({ actorId: user.id, agencyId: parseRequest(uuidParam, agencyId), membershipId, role });
  }

  @Delete(':memberId')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ description: 'Accès retiré.' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('agencyId') agencyId: string, @Param('memberId') memberId: string): Promise<{ success: true }> {
    return this.revokeMembership.handle({ actorId: user.id, agencyId: parseRequest(uuidParam, agencyId), membershipId: parseRequest(uuidParam, memberId) });
  }
}
