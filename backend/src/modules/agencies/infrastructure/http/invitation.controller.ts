import { Body, Controller, Header, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CommandHandler } from '../../../../shared/application/command-handler';
import { TransactionalCommandHandlerFactory } from '../../../../shared/infrastructure/db/transactional-command-handler.factory';
import { parseRequest, uuidParam } from '../../../../shared/infrastructure/http/parse-request';
import { AuthenticatedUser } from '../../../identity/application/queries/authenticate/authenticated-user';
import { AccessTokenGuard } from '../../../identity/infrastructure/security/access-token.guard';
import { CurrentUser } from '../../../identity/infrastructure/security/current-user.decorator';
import { AcceptInvitationCommand } from '../../application/command/accept-invitation/accept-invitation.command';
import { AcceptInvitationHandler } from '../../application/command/accept-invitation/accept-invitation.handler';
import { AcceptInvitationResponse } from '../../application/command/accept-invitation/accept-invitation.response';
import { IssueInvitationCommand } from '../../application/command/issue-invitation/issue-invitation.command';
import { IssueInvitationHandler } from '../../application/command/issue-invitation/issue-invitation.handler';
import { IssueInvitationResponse } from '../../application/command/issue-invitation/issue-invitation.response';
import { acceptInvitationRequest, issueInvitationRequest } from './requests/agency.requests';

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
  issue(@CurrentUser() user: AuthenticatedUser, @Param('agencyId') agencyId: string, @Body() body: unknown): Promise<IssueInvitationResponse> {
    const validAgencyId = parseRequest(uuidParam, agencyId);
    const { email, role } = parseRequest(issueInvitationRequest, body);
    return this.issueInvitation.handle({ actorId: user.id, agencyId: validAgencyId, email, role });
  }

  @Post('agency-invitations/accept')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiBody({ schema: { type: 'object', required: ['token'], properties: { token: { type: 'string', writeOnly: true } } } })
  @ApiOkResponse({ schema: { type: 'object', required: ['agencyId', 'role'], properties: { agencyId: { type: 'string', format: 'uuid' }, role: { type: 'string', enum: ['admin', 'agent'] } } } })
  accept(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown): Promise<AcceptInvitationResponse> {
    const { token } = parseRequest(acceptInvitationRequest, body);
    return this.acceptInvitation.handle({ userId: user.id, email: user.email, token });
  }
}
