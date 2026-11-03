import { Body, Controller, Get, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiBodyOptions, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CommandHandler } from '../../../../shared/application/command-handler';
import { TransactionalCommandHandlerFactory } from '../../../../shared/infrastructure/db/transactional-command-handler.factory';
import { parseRequest } from '../../../../shared/infrastructure/http/parse-request';
import { LogoutCommand } from '../../application/command/logout/logout.command';
import { LogoutHandler } from '../../application/command/logout/logout.handler';
import { RefreshSessionCommand } from '../../application/command/refresh-session/refresh-session.command';
import { RefreshSessionHandler } from '../../application/command/refresh-session/refresh-session.handler';
import { SessionTokensResponse } from '../../application/command/session-tokens.response';
import { AuthenticatedUser } from '../../application/queries/authenticate/authenticated-user';
import { AccessTokenGuard } from '../security/access-token.guard';
import { CurrentUser } from '../security/current-user.decorator';
import { refreshTokenRequest } from './requests/identity.requests';

const tokenBody: ApiBodyOptions = { schema: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string', writeOnly: true } } } };

@ApiTags('auth')
@Controller()
export class SessionController {
  private readonly refreshSession: CommandHandler<RefreshSessionCommand, SessionTokensResponse>;
  private readonly logoutSession: CommandHandler<LogoutCommand, { success: true }>;

  constructor(refresh: RefreshSessionHandler, logout: LogoutHandler, transactional: TransactionalCommandHandlerFactory) {
    this.refreshSession = transactional.create(refresh);
    this.logoutSession = transactional.create(logout);
  }

  @Post('auth/refresh')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiBody(tokenBody)
  @ApiOkResponse({ description: 'Tokens renouvelés ; le jeton précédent est invalidé.', schema: { type: 'object', required: ['accessToken', 'refreshToken', 'expiresIn'], properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' }, expiresIn: { type: 'number', example: 900 } } } })
  refresh(@Body() body: unknown): Promise<SessionTokensResponse> {
    return this.refreshSession.handle(parseRequest(refreshTokenRequest, body));
  }

  @Post('auth/logout')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiBody(tokenBody)
  @ApiOkResponse({ description: 'Session révoquée.' })
  logout(@Body() body: unknown): Promise<{ success: true }> {
    return this.logoutSession.handle(parseRequest(refreshTokenRequest, body));
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiTags('me')
  @ApiHeader({ name: 'authorization', required: true })
  @ApiOkResponse({ schema: { type: 'object', required: ['id', 'email', 'accountType'], properties: { id: { type: 'string', format: 'uuid' }, email: { type: 'string', format: 'email' }, accountType: { type: 'string', enum: ['individual', 'merchant'] } } } })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
