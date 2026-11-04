import { Body, Controller, Get, Header, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { AuthenticatedUser } from '@modules/identity/application/read-models/authenticated-user.read-model';
import { CurrentUser } from '@modules/identity/presentation/http/decorators/current-user.decorator';
import { AccessTokenGuard } from '@modules/identity/presentation/http/guards/access-token.guard';
import { CommandHandler } from '@shared/application/command-handler';
import { TransactionalCommandHandlerFactory } from '@shared/infrastructure/persistence/typeorm/transactional-command-handler.factory';
import { IdempotencyKey } from '@shared/presentation/http/idempotency-key.decorator';
import { uuidSchema, ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe';
import { CreateAgencyCommand } from '../../application/commands/create-agency/create-agency.command';
import { CreateAgencyHandler } from '../../application/commands/create-agency/create-agency.handler';
import { CreateAgencyResponse } from '../../application/commands/create-agency/create-agency.response';
import { GetAgencyOnboardingHandler } from '../../application/queries/get-agency-onboarding/get-agency-onboarding.handler';
import { GetAgencyOnboardingResponse } from '../../application/queries/get-agency-onboarding/get-agency-onboarding.response';
import { createAgencyRequest } from './dto/create-agency.request';

const PREREQUISITE_CODES = ['legal_name', 'headquarters_city', 'headquarters_address', 'primary_phone', 'active_capability', 'active_site'];

@ApiTags('agencies')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('agencies')
export class AgencyController {
  private readonly createAgency: CommandHandler<CreateAgencyCommand, CreateAgencyResponse>;

  constructor(create: CreateAgencyHandler, private readonly getOnboarding: GetAgencyOnboardingHandler, transactional: TransactionalCommandHandlerFactory) {
    this.createAgency = transactional.create(create);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'De 8 à 128 caractères ASCII visibles, propre à l’utilisateur. Même clé et même contenu : même agence ; autre contenu : 409.' })
  @ApiBody({ schema: { type: 'object', required: ['tradeName'], additionalProperties: false, properties: { tradeName: { type: 'string', minLength: 2, maxLength: 120 } } } })
  @ApiCreatedResponse({ schema: { type: 'object', required: ['agencyId', 'tradeName', 'status', 'role'], properties: { agencyId: { type: 'string', format: 'uuid' }, tradeName: { type: 'string' }, status: { type: 'string', enum: ['draft'] }, role: { type: 'string', enum: ['owner'] } } } })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @IdempotencyKey() idempotencyKey: string | null,
    @Body(new ZodValidationPipe(createAgencyRequest)) body: z.output<typeof createAgencyRequest>,
  ): Promise<CreateAgencyResponse> {
    return this.createAgency.handle({ actorId: user.id, tradeName: body.tradeName, idempotencyKey });
  }

  @Get(':agencyId/onboarding')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['status', 'submission', 'prerequisites', 'readyForSubmission', 'capabilities', 'hybrid', 'activeZones', 'activeSites'],
      properties: {
        status: { type: 'string', enum: ['draft', 'submitted'] },
        submission: { type: 'object', nullable: true, properties: { submittedAt: { type: 'string', format: 'date-time' }, submittedBy: { type: 'string', format: 'uuid' } } },
        prerequisites: { type: 'array', items: { type: 'object', required: ['code', 'filled'], properties: { code: { type: 'string', enum: PREREQUISITE_CODES }, filled: { type: 'boolean' } } } },
        readyForSubmission: { type: 'boolean' },
        capabilities: { type: 'array', items: { type: 'object', required: ['type', 'state', 'since', 'reason', 'acceptsNewRequests'], properties: { type: { type: 'string', enum: ['delivery', 'storage'] }, state: { type: 'string', enum: ['active', 'suspended'] }, since: { type: 'string', format: 'date-time' }, reason: { type: 'string', nullable: true }, acceptsNewRequests: { type: 'boolean' } } } },
        hybrid: { type: 'boolean' },
        activeZones: { type: 'integer' },
        activeSites: { type: 'integer' },
      },
    },
  })
  onboarding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
  ): Promise<GetAgencyOnboardingResponse> {
    return this.getOnboarding.handle({ agencyId, userId: user.id });
  }
}
