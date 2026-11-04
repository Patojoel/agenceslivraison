import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthenticatedUser } from '@modules/identity/application/read-models/authenticated-user.read-model';
import { CurrentUser } from '@modules/identity/presentation/http/decorators/current-user.decorator';
import { AccessTokenGuard } from '@modules/identity/presentation/http/guards/access-token.guard';
import { CommandHandler } from '@shared/application/command-handler';
import { TransactionalCommandHandlerFactory } from '@shared/infrastructure/persistence/typeorm/transactional-command-handler.factory';
import { uuidSchema, ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe';
import { AddServiceZoneCommand } from '../../application/commands/add-service-zone/add-service-zone.command';
import { AddServiceZoneHandler } from '../../application/commands/add-service-zone/add-service-zone.handler';
import { AddServiceZoneResponse } from '../../application/commands/add-service-zone/add-service-zone.response';
import { RetireServiceZoneCommand } from '../../application/commands/retire-service-zone/retire-service-zone.command';
import { RetireServiceZoneHandler } from '../../application/commands/retire-service-zone/retire-service-zone.handler';
import { RetireServiceZoneResponse } from '../../application/commands/retire-service-zone/retire-service-zone.response';
import { ListServiceZonesHandler } from '../../application/queries/list-service-zones/list-service-zones.handler';
import { ListServiceZonesResponse } from '../../application/queries/list-service-zones/list-service-zones.response';
import { addServiceZoneRequest } from './dto/add-service-zone.request';
import { cursorParam, limitParam } from './dto/list-my-agencies.request';

const ZONE_SCHEMA = {
  type: 'object',
  required: ['id', 'city', 'district', 'status', 'addedAt', 'retiredAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    city: { type: 'string' },
    district: { type: 'string', nullable: true },
    status: { type: 'string', enum: ['active', 'retired'] },
    addedAt: { type: 'string', format: 'date-time' },
    retiredAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

@ApiTags('agency-zones')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('agencies/:agencyId/zones')
export class ServiceZoneController {
  private readonly addZone: CommandHandler<AddServiceZoneCommand, AddServiceZoneResponse>;
  private readonly retireZone: CommandHandler<RetireServiceZoneCommand, RetireServiceZoneResponse>;

  constructor(add: AddServiceZoneHandler, retire: RetireServiceZoneHandler, private readonly listZones: ListServiceZonesHandler, transactional: TransactionalCommandHandlerFactory) {
    this.addZone = transactional.create(add);
    this.retireZone = transactional.create(retire);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Ajoute une zone desservie (propriétaire ou administrateur). Une zone retirée puis ajoutée de nouveau revient avec le même identifiant.' })
  @ApiBody({ schema: { type: 'object', required: ['city'], additionalProperties: false, properties: { city: { type: 'string', minLength: 2, maxLength: 80 }, district: { type: 'string', nullable: true, minLength: 2, maxLength: 80, description: 'Sans quartier, la zone couvre toute la ville.' } } } })
  @ApiCreatedResponse({ schema: ZONE_SCHEMA })
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Body(new ZodValidationPipe(addServiceZoneRequest)) body: z.output<typeof addServiceZoneRequest>,
  ): Promise<AddServiceZoneResponse> {
    return this.addZone.handle({ actorId: user.id, agencyId, city: body.city, district: body.district ?? null });
  }

  @Delete(':zoneId')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Retire une zone (retrait logique : elle reste listée, avec sa date de retrait). Refusé pour la dernière zone active tant que la livraison est active.' })
  @ApiOkResponse({ schema: ZONE_SCHEMA })
  retire(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Param('zoneId', new ZodValidationPipe(uuidSchema)) zoneId: string,
  ): Promise<RetireServiceZoneResponse> {
    return this.retireZone.handle({ actorId: user.id, agencyId, zoneId });
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Liste les zones de l’agence, actives d’abord puis retirées, pour tout membre actif.' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'De 1 à 100, 20 par défaut.' })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'La valeur `nextCursor` de la page précédente.' })
  @ApiOkResponse({ schema: { type: 'object', required: ['items', 'nextCursor', 'hasMore'], properties: { items: { type: 'array', items: ZONE_SCHEMA }, nextCursor: { type: 'string', format: 'uuid', nullable: true }, hasMore: { type: 'boolean' } } } })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Query('limit', new ZodValidationPipe(limitParam)) limit: number,
    @Query('cursor', new ZodValidationPipe(cursorParam)) cursor: string | null,
  ): Promise<ListServiceZonesResponse> {
    return this.listZones.handle({ agencyId, userId: user.id, limit, cursor });
  }
}
