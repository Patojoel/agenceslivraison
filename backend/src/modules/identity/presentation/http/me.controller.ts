import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../application/read-models/authenticated-user.read-model';
import { CurrentUser } from './decorators/current-user.decorator';
import { AccessTokenGuard } from './guards/access-token.guard';

@ApiTags('auth')
@Controller('me')
export class MeController {
  @Get()
  @Header('Cache-Control', 'no-store')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiTags('me')
  @ApiOperation({ operationId: 'SessionController_me' })
  @ApiHeader({ name: 'authorization', required: true })
  @ApiOkResponse({ schema: { type: 'object', required: ['id', 'email', 'accountType'], properties: { id: { type: 'string', format: 'uuid' }, email: { type: 'string', format: 'email' }, accountType: { type: 'string', enum: ['individual', 'merchant'] } } } })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
