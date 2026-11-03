import { Body, Controller, Header, Post } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CommandHandler } from '../../../../shared/application/command-handler';
import { TransactionalCommandHandlerFactory } from '../../../../shared/infrastructure/db/transactional-command-handler.factory';
import { parseRequest } from '../../../../shared/infrastructure/http/parse-request';
import { RegisterUserCommand } from '../../application/command/register-user/register-user.command';
import { RegisterUserHandler } from '../../application/command/register-user/register-user.handler';
import { RegisterUserResponse } from '../../application/command/register-user/register-user.response';
import { registerRequest } from './requests/identity.requests';

@ApiTags('auth')
@Controller('auth')
export class RegistrationController {
  private readonly registerUser: CommandHandler<RegisterUserCommand, RegisterUserResponse>;

  constructor(handler: RegisterUserHandler, transactional: TransactionalCommandHandlerFactory) {
    this.registerUser = transactional.create(handler);
  }

  @Post('register')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBody({ schema: { type: 'object', required: ['email', 'password', 'accountType'], properties: {
    email: { type: 'string', format: 'email', maxLength: 254 },
    password: { type: 'string', minLength: 12, maxLength: 128, format: 'password', writeOnly: true },
    accountType: { type: 'string', enum: ['individual', 'merchant'] },
  } } })
  @ApiCreatedResponse({ schema: { type: 'object', required: ['id', 'accountType'], properties: { id: { type: 'string', format: 'uuid' }, accountType: { type: 'string', enum: ['individual', 'merchant'] } } } })
  register(@Body() body: unknown): Promise<RegisterUserResponse> {
    return this.registerUser.handle(parseRequest(registerRequest, body));
  }
}
