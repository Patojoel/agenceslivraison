import { Body, Controller, Header, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CommandHandler } from '../../../../shared/application/command-handler';
import { TransactionalCommandHandlerFactory } from '../../../../shared/infrastructure/db/transactional-command-handler.factory';
import { parseRequest } from '../../../../shared/infrastructure/http/parse-request';
import { LoginCommand } from '../../application/command/login/login.command';
import { LoginHandler } from '../../application/command/login/login.handler';
import { SessionTokensResponse } from '../../application/command/session-tokens.response';
import { loginRequest } from './requests/identity.requests';

@ApiTags('auth')
@Controller('auth')
export class LoginController {
  private readonly loginUser: CommandHandler<LoginCommand, SessionTokensResponse>;

  constructor(handler: LoginHandler, transactional: TransactionalCommandHandlerFactory) {
    this.loginUser = transactional.create(handler);
  }

  @Post('login')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBody({ schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password', writeOnly: true } } } })
  @ApiOkResponse({ schema: { type: 'object', required: ['accessToken', 'refreshToken', 'expiresIn'], properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' }, expiresIn: { type: 'number', example: 900 } } } })
  login(@Body() body: unknown): Promise<SessionTokensResponse> {
    return this.loginUser.handle(parseRequest(loginRequest, body));
  }
}
