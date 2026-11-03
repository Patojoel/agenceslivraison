import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { parseRequest, uuidParam } from '../../../../shared/infrastructure/http/parse-request';
import { AuthenticatedUser } from '../../../identity/application/queries/authenticate/authenticated-user';
import { AccessTokenGuard } from '../../../identity/infrastructure/security/access-token.guard';
import { CurrentUser } from '../../../identity/infrastructure/security/current-user.decorator';
import { ListMyAgenciesQueryHandler } from '../../application/queries/list-my-agencies/list-my-agencies.query-handler';
import { ListMyAgenciesResponse } from '../../application/queries/list-my-agencies/list-my-agencies.response';

const limitParam = z.union([z.undefined().transform(() => 20), z.string().transform(Number).pipe(z.number().int().min(1).max(100))]);

@ApiTags('auth')
@Controller('me/agencies')
export class MyAgenciesController {
  constructor(private readonly listMyAgencies: ListMyAgenciesQueryHandler) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ operationId: 'SessionController_agencies', summary: undefined })
  @ApiBearerAuth()
  @ApiTags('me')
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  list(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string, @Query('cursor') cursor?: string): Promise<ListMyAgenciesResponse> {
    return this.listMyAgencies.handle({
      userId: user.id,
      limit: parseRequest(limitParam, limit),
      cursor: cursor === undefined ? null : parseRequest(uuidParam, cursor),
    });
  }
}
