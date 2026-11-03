import { Body, Controller, Header, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { AuthenticatedUser } from '@modules/identity/application/read-models/authenticated-user.read-model';
import { CurrentUser } from '@modules/identity/presentation/http/decorators/current-user.decorator';
import { AccessTokenGuard } from '@modules/identity/presentation/http/guards/access-token.guard';
import { CommandHandler } from '@shared/application/command-handler';
import { TransactionalCommandHandlerFactory } from '@shared/infrastructure/persistence/typeorm/transactional-command-handler.factory';
import { uuidSchema, ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe';
import { AcceptInvitationCommand } from '../../application/commands/accept-invitation/accept-invitation.command';
import { AcceptInvitationHandler } from '../../application/commands/accept-invitation/accept-invitation.handler';
import { AcceptInvitationResponse } from '../../application/commands/accept-invitation/accept-invitation.response';
import { IssueInvitationCommand } from '../../application/commands/issue-invitation/issue-invitation.command';
import { IssueInvitationHandler } from '../../application/commands/issue-invitation/issue-invitation.handler';
import { IssueInvitationResponse } from '../../application/commands/issue-invitation/issue-invitation.response';
import { acceptInvitationRequest } from './dto/accept-invitation.request';
import { issueInvitationRequest } from './dto/issue-invitation.request';

@ApiTags('agency-invitations')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class InvitationController {
  private readonly issueInvitation: CommandHandler<IssueInvitationCommand, IssueInvitationResponse>;
  private readonly acceptInvitation: CommandHandler<AcceptInvitationCommand, AcceptInvitationResponse>;

  constructor(issue: IssueInvitationHandler, accept: AcceptInvitationHandler, transactional: TransactionalCommandHandlerFactory) {
    this.issueInvitation = transactional.create(issue);
    this.acceptInvitation = transactional.create(accept);
  }

  @Post('agencies/:agencyId/invitations')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiBody({ schema: { type: 'object', required: ['email', 'role'], properties: { email: { type: 'string', format: 'email' }, role: { type: 'string', enum: ['admin', 'agent'] } } } })
  @ApiCreatedResponse({ schema: { type: 'object', required: ['token', 'expiresAt'], properties: { token: { type: 'string', description: 'À transmettre confidentiellement une seule fois' }, expiresAt: { type: 'string', format: 'date-time' } } } })
  issue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Body(new ZodValidationPipe(issueInvitationRequest)) body: z.output<typeof issueInvitationRequest>,
  ): Promise<IssueInvitationResponse> {
    return this.issueInvitation.handle({ actorId: user.id, agencyId, email: body.email, role: body.role });
  }

  @Post('agency-invitations/accept')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiBody({ schema: { type: 'object', required: ['token'], properties: { token: { type: 'string', writeOnly: true } } } })
  @ApiOkResponse({ schema: { type: 'object', required: ['agencyId', 'role'], properties: { agencyId: { type: 'string', format: 'uuid' }, role: { type: 'string', enum: ['admin', 'agent'] } } } })
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(acceptInvitationRequest)) body: z.output<typeof acceptInvitationRequest>,
  ): Promise<AcceptInvitationResponse> {
    return this.acceptInvitation.handle({ userId: user.id, email: user.email, token: body.token });
  }
}
