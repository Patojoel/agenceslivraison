import { Body, Controller, Delete, Header, HttpCode, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthenticatedUser } from '@modules/identity/application/read-models/authenticated-user.read-model';
import { CurrentUser } from '@modules/identity/presentation/http/decorators/current-user.decorator';
import { AccessTokenGuard } from '@modules/identity/presentation/http/guards/access-token.guard';
import { CommandHandler } from '@shared/application/command-handler';
import { TransactionalCommandHandlerFactory } from '@shared/infrastructure/persistence/typeorm/transactional-command-handler.factory';
import { uuidSchema, ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe';
import { ChangeMemberRoleCommand } from '../../application/commands/change-member-role/change-member-role.command';
import { ChangeMemberRoleHandler } from '../../application/commands/change-member-role/change-member-role.handler';
import { RevokeMembershipCommand } from '../../application/commands/revoke-membership/revoke-membership.command';
import { RevokeMembershipHandler } from '../../application/commands/revoke-membership/revoke-membership.handler';
import { changeMemberRoleRequest } from './dto/change-member-role.request';

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
  change(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Param('memberId', new ZodValidationPipe(uuidSchema)) membershipId: string,
    @Body(new ZodValidationPipe(changeMemberRoleRequest)) body: z.output<typeof changeMemberRoleRequest>,
  ): Promise<{ success: true }> {
    return this.changeRole.handle({ actorId: user.id, agencyId, membershipId, role: body.role });
  }

  @Delete(':memberId')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ description: 'Accès retiré.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Param('memberId', new ZodValidationPipe(uuidSchema)) membershipId: string,
  ): Promise<{ success: true }> {
    return this.revokeMembership.handle({ actorId: user.id, agencyId, membershipId });
  }
}
