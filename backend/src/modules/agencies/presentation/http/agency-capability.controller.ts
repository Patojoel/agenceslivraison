import { Body, Controller, Header, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthenticatedUser } from '@modules/identity/application/read-models/authenticated-user.read-model';
import { CurrentUser } from '@modules/identity/presentation/http/decorators/current-user.decorator';
import { AccessTokenGuard } from '@modules/identity/presentation/http/guards/access-token.guard';
import { CommandHandler } from '@shared/application/command-handler';
import { TransactionalCommandHandlerFactory } from '@shared/infrastructure/persistence/typeorm/transactional-command-handler.factory';
import { uuidSchema, ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe';
import { EnableCapabilityCommand } from '../../application/commands/enable-capability/enable-capability.command';
import { EnableCapabilityHandler } from '../../application/commands/enable-capability/enable-capability.handler';
import { EnableCapabilityResponse } from '../../application/commands/enable-capability/enable-capability.response';
import { SuspendCapabilityCommand } from '../../application/commands/suspend-capability/suspend-capability.command';
import { SuspendCapabilityHandler } from '../../application/commands/suspend-capability/suspend-capability.handler';
import { SuspendCapabilityResponse } from '../../application/commands/suspend-capability/suspend-capability.response';
import { capabilityTypeParam, noBody, suspendCapabilityRequest } from './dto/suspend-capability.request';

const CAPABILITIES_SCHEMA = {
  type: 'object',
  required: ['capabilities', 'hybrid'],
  properties: {
    capabilities: {
      type: 'array',
      description: 'Les capacités déjà activées au moins une fois, avec leur état courant.',
      items: {
        type: 'object',
        required: ['type', 'state', 'since', 'reason', 'acceptsNewRequests'],
        properties: { type: { type: 'string', enum: ['delivery', 'storage'] }, state: { type: 'string', enum: ['active', 'suspended'] }, since: { type: 'string', format: 'date-time' }, reason: { type: 'string', nullable: true }, acceptsNewRequests: { type: 'boolean' } },
      },
    },
    hybrid: { type: 'boolean', description: 'Vrai quand la livraison et le stockage sont tous deux actifs.' },
  },
};
const TYPE_PARAM = { name: 'type', enum: ['delivery', 'storage'], description: 'La capacité.' };

@ApiTags('agency-capabilities')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('agencies/:agencyId/capabilities/:type')
export class AgencyCapabilityController {
  private readonly enable: CommandHandler<EnableCapabilityCommand, EnableCapabilityResponse>;
  private readonly suspend: CommandHandler<SuspendCapabilityCommand, SuspendCapabilityResponse>;

  constructor(enable: EnableCapabilityHandler, suspend: SuspendCapabilityHandler, transactional: TransactionalCommandHandlerFactory) {
    this.enable = transactional.create(enable);
    this.suspend = transactional.create(suspend);
  }

  @Post('activate')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Active une capacité, ou la réactive après suspension. Livraison : au moins une zone active ; stockage : au moins un site actif (sinon 400, `missing` nomme ce qui manque). Déjà active : 409.' })
  @ApiParam(TYPE_PARAM)
  @ApiOkResponse({ schema: CAPABILITIES_SCHEMA })
  activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Param('type', new ZodValidationPipe(capabilityTypeParam)) type: z.output<typeof capabilityTypeParam>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the pipe is the point: it refuses any body
    @Body(new ZodValidationPipe(noBody)) _body: z.output<typeof noBody>,
  ): Promise<EnableCapabilityResponse> {
    return this.enable.handle({ actorId: user.id, agencyId, capability: type });
  }

  @Post('suspend')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Suspend une capacité active, avec un motif. Les nouvelles demandes sont refusées, l’historique est conservé. Pas active : 409.' })
  @ApiParam(TYPE_PARAM)
  @ApiBody({ schema: { type: 'object', required: ['reason'], additionalProperties: false, properties: { reason: { type: 'string', minLength: 3, maxLength: 500 } } } })
  @ApiOkResponse({ schema: CAPABILITIES_SCHEMA })
  suspendCapability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Param('type', new ZodValidationPipe(capabilityTypeParam)) type: z.output<typeof capabilityTypeParam>,
    @Body(new ZodValidationPipe(suspendCapabilityRequest)) body: z.output<typeof suspendCapabilityRequest>,
  ): Promise<SuspendCapabilityResponse> {
    return this.suspend.handle({ actorId: user.id, agencyId, capability: type, reason: body.reason });
  }
}
