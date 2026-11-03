import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '@modules/identity/application/read-models/authenticated-user.read-model';
import { CurrentUser } from '@modules/identity/presentation/http/decorators/current-user.decorator';
import { AccessTokenGuard } from '@modules/identity/presentation/http/guards/access-token.guard';
import { ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe';
import { ListMyAgenciesHandler } from '../../application/queries/list-my-agencies/list-my-agencies.handler';
import { ListMyAgenciesResponse } from '../../application/queries/list-my-agencies/list-my-agencies.response';
import { cursorParam, limitParam } from './dto/list-my-agencies.request';

@ApiTags('auth')
@Controller('me/agencies')
export class MyAgenciesController {
  constructor(private readonly listMyAgencies: ListMyAgenciesHandler) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ operationId: 'SessionController_agencies', summary: undefined })
  @ApiBearerAuth()
  @ApiTags('me')
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit', new ZodValidationPipe(limitParam)) limit: number,
    @Query('cursor', new ZodValidationPipe(cursorParam)) cursor: string | null,
  ): Promise<ListMyAgenciesResponse> {
    return this.listMyAgencies.handle({ userId: user.id, limit, cursor });
  }
}
