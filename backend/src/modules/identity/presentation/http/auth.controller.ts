import { Body, Controller, Header, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiBodyOptions, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CommandHandler } from '@shared/application/command-handler';
import { TransactionalCommandHandlerFactory } from '@shared/infrastructure/persistence/typeorm/transactional-command-handler.factory';
import { ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe';
import { LoginCommand } from '../../application/commands/login/login.command';
import { LoginHandler } from '../../application/commands/login/login.handler';
import { LogoutCommand } from '../../application/commands/logout/logout.command';
import { LogoutHandler } from '../../application/commands/logout/logout.handler';
import { RefreshSessionCommand } from '../../application/commands/refresh-session/refresh-session.command';
import { RefreshSessionHandler } from '../../application/commands/refresh-session/refresh-session.handler';
import { RegisterUserCommand } from '../../application/commands/register-user/register-user.command';
import { RegisterUserHandler } from '../../application/commands/register-user/register-user.handler';
import { RegisterUserResponse } from '../../application/commands/register-user/register-user.response';
import { SessionTokensResponse } from '../../application/commands/session-tokens.response';
import { loginRequest } from './dto/login.request';
import { refreshTokenRequest } from './dto/refresh-token.request';
import { registerRequest } from './dto/register.request';

const sessionTokens = {
  type: 'object', required: ['accessToken', 'refreshToken', 'expiresIn'],
  properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' }, expiresIn: { type: 'number', example: 900 } },
};
const tokenBody: ApiBodyOptions = { schema: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string', writeOnly: true } } } };

/** Operation ids predate the merge of the auth controllers: kept so generated clients do not change. */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly registerUser: CommandHandler<RegisterUserCommand, RegisterUserResponse>;
  private readonly loginUser: CommandHandler<LoginCommand, SessionTokensResponse>;
  private readonly refreshSession: CommandHandler<RefreshSessionCommand, SessionTokensResponse>;
  private readonly logoutSession: CommandHandler<LogoutCommand, { success: true }>;

  constructor(
    register: RegisterUserHandler,
    login: LoginHandler,
    refresh: RefreshSessionHandler,
    logout: LogoutHandler,
    transactional: TransactionalCommandHandlerFactory,
  ) {
    this.registerUser = transactional.create(register);
    this.loginUser = transactional.create(login);
    this.refreshSession = transactional.create(refresh);
    this.logoutSession = transactional.create(logout);
  }

  @Post('register')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ operationId: 'RegistrationController_register' })
  @ApiBody({ schema: { type: 'object', required: ['email', 'password', 'accountType'], properties: {
    email: { type: 'string', format: 'email', maxLength: 254 },
    password: { type: 'string', minLength: 12, maxLength: 128, format: 'password', writeOnly: true },
    accountType: { type: 'string', enum: ['individual', 'merchant'] },
  } } })
  @ApiCreatedResponse({ schema: { type: 'object', required: ['id', 'accountType'], properties: { id: { type: 'string', format: 'uuid' }, accountType: { type: 'string', enum: ['individual', 'merchant'] } } } })
  register(@Body(new ZodValidationPipe(registerRequest)) body: z.output<typeof registerRequest>): Promise<RegisterUserResponse> {
    return this.registerUser.handle(body);
  }

  @Post('login')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ operationId: 'LoginController_login' })
  @ApiBody({ schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password', writeOnly: true } } } })
  @ApiOkResponse({ schema: sessionTokens })
  login(@Body(new ZodValidationPipe(loginRequest)) body: z.output<typeof loginRequest>): Promise<SessionTokensResponse> {
    return this.loginUser.handle(body);
  }

  @Post('refresh')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ operationId: 'SessionController_refresh' })
  @ApiBody(tokenBody)
  @ApiOkResponse({ description: 'Tokens renouvelés ; le jeton précédent est invalidé.', schema: sessionTokens })
  refresh(@Body(new ZodValidationPipe(refreshTokenRequest)) body: z.output<typeof refreshTokenRequest>): Promise<SessionTokensResponse> {
    return this.refreshSession.handle(body);
  }

  @Post('logout')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ operationId: 'SessionController_logout' })
  @ApiBody(tokenBody)
  @ApiOkResponse({ description: 'Session révoquée.' })
  logout(@Body(new ZodValidationPipe(refreshTokenRequest)) body: z.output<typeof refreshTokenRequest>): Promise<{ success: true }> {
    return this.logoutSession.handle(body);
  }
}
