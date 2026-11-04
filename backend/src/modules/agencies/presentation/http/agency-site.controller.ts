import { Body, Controller, Get, Header, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedUser } from '@modules/identity/application/read-models/authenticated-user.read-model';
import { CurrentUser } from '@modules/identity/presentation/http/decorators/current-user.decorator';
import { AccessTokenGuard } from '@modules/identity/presentation/http/guards/access-token.guard';
import { CommandHandler } from '@shared/application/command-handler';
import { TransactionalCommandHandlerFactory } from '@shared/infrastructure/persistence/typeorm/transactional-command-handler.factory';
import { etagOf, IfMatchVersion } from '@shared/presentation/http/if-match-version.decorator';
import { uuidSchema, ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe';
import { CreateAgencySiteCommand } from '../../application/commands/create-agency-site/create-agency-site.command';
import { CreateAgencySiteHandler } from '../../application/commands/create-agency-site/create-agency-site.handler';
import { CreateAgencySiteResponse } from '../../application/commands/create-agency-site/create-agency-site.response';
import { DeactivateAgencySiteCommand } from '../../application/commands/deactivate-agency-site/deactivate-agency-site.command';
import { DeactivateAgencySiteHandler } from '../../application/commands/deactivate-agency-site/deactivate-agency-site.handler';
import { DeactivateAgencySiteResponse } from '../../application/commands/deactivate-agency-site/deactivate-agency-site.response';
import { ReactivateAgencySiteCommand } from '../../application/commands/reactivate-agency-site/reactivate-agency-site.command';
import { ReactivateAgencySiteHandler } from '../../application/commands/reactivate-agency-site/reactivate-agency-site.handler';
import { ReactivateAgencySiteResponse } from '../../application/commands/reactivate-agency-site/reactivate-agency-site.response';
import { UpdateAgencySiteCommand } from '../../application/commands/update-agency-site/update-agency-site.command';
import { UpdateAgencySiteHandler } from '../../application/commands/update-agency-site/update-agency-site.handler';
import { UpdateAgencySiteResponse } from '../../application/commands/update-agency-site/update-agency-site.response';
import { ListAgencySitesHandler } from '../../application/queries/list-agency-sites/list-agency-sites.handler';
import { ListAgencySitesResponse } from '../../application/queries/list-agency-sites/list-agency-sites.response';
import { createAgencySiteRequest } from './dto/create-agency-site.request';
import { cursorParam, limitParam } from './dto/list-my-agencies.request';
import { updateAgencySiteRequest } from './dto/update-agency-site.request';

const SITE_SCHEMA = {
  type: 'object',
  required: ['id', 'name', 'city', 'address', 'phone', 'status', 'createdAt', 'deactivatedAt', 'version'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    city: { type: 'string' },
    address: { type: 'string' },
    phone: { type: 'string', nullable: true },
    status: { type: 'string', enum: ['active', 'inactive'] },
    createdAt: { type: 'string', format: 'date-time' },
    deactivatedAt: { type: 'string', format: 'date-time', nullable: true },
    version: { type: 'integer', description: 'La version du site, distincte de celle de l’agence.' },
  },
};
const ETAG_HEADER = { ETag: { description: 'La version du site, entre guillemets (`"3"`).', schema: { type: 'string' } } };

@ApiTags('agency-sites')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('agencies/:agencyId/sites')
export class AgencySiteController {
  private readonly createSite: CommandHandler<CreateAgencySiteCommand, CreateAgencySiteResponse>;
  private readonly updateSite: CommandHandler<UpdateAgencySiteCommand, UpdateAgencySiteResponse>;
  private readonly deactivateSite: CommandHandler<DeactivateAgencySiteCommand, DeactivateAgencySiteResponse>;
  private readonly reactivateSite: CommandHandler<ReactivateAgencySiteCommand, ReactivateAgencySiteResponse>;

  constructor(
    create: CreateAgencySiteHandler,
    update: UpdateAgencySiteHandler,
    deactivate: DeactivateAgencySiteHandler,
    reactivate: ReactivateAgencySiteHandler,
    private readonly listSites: ListAgencySitesHandler,
    transactional: TransactionalCommandHandlerFactory,
  ) {
    this.createSite = transactional.create(create);
    this.updateSite = transactional.create(update);
    this.deactivateSite = transactional.create(deactivate);
    this.reactivateSite = transactional.create(reactivate);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Crée un site actif (propriétaire ou administrateur).' })
  @ApiBody({ schema: { type: 'object', required: ['name', 'city', 'address'], additionalProperties: false, properties: { name: { type: 'string', minLength: 2, maxLength: 120 }, city: { type: 'string', minLength: 2, maxLength: 80 }, address: { type: 'string', minLength: 5, maxLength: 300 }, phone: { type: 'string', nullable: true, description: '+237 puis 9 chiffres commençant par 2 ou 6 ; les espaces sont tolérés.' } } } })
  @ApiCreatedResponse({ schema: SITE_SCHEMA, headers: ETAG_HEADER })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Body(new ZodValidationPipe(createAgencySiteRequest)) body: z.output<typeof createAgencySiteRequest>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CreateAgencySiteResponse> {
    const site = await this.createSite.handle({ actorId: user.id, agencyId, name: body.name, city: body.city, address: body.address, phone: body.phone ?? null });
    response.setHeader('ETag', etagOf(site.version));
    return site;
  }

  @Patch(':siteId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Modifie un site actif, partiellement. Sans effet réel : même version.' })
  @ApiHeader({ name: 'If-Match', required: true, description: 'La version du site lue, nue (`3`) ou entre guillemets (`"3"`). Absente : 428. Périmée : 409.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { name: { type: 'string', minLength: 2, maxLength: 120 }, city: { type: 'string', minLength: 2, maxLength: 80 }, address: { type: 'string', minLength: 5, maxLength: 300 }, phone: { type: 'string', nullable: true } } } })
  @ApiOkResponse({ schema: SITE_SCHEMA, headers: ETAG_HEADER })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Param('siteId', new ZodValidationPipe(uuidSchema)) siteId: string,
    @IfMatchVersion() expectedVersion: number,
    @Body(new ZodValidationPipe(updateAgencySiteRequest)) body: z.output<typeof updateAgencySiteRequest>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UpdateAgencySiteResponse> {
    const site = await this.updateSite.handle({ actorId: user.id, agencyId, siteId, expectedVersion, changes: body });
    response.setHeader('ETag', etagOf(site.version));
    return site;
  }

  @Post(':siteId/deactivate')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Désactive un site (il est conservé). Refusé pour le dernier site actif tant que le stockage est actif.' })
  @ApiOkResponse({ schema: SITE_SCHEMA, headers: ETAG_HEADER })
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Param('siteId', new ZodValidationPipe(uuidSchema)) siteId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DeactivateAgencySiteResponse> {
    const site = await this.deactivateSite.handle({ actorId: user.id, agencyId, siteId });
    response.setHeader('ETag', etagOf(site.version));
    return site;
  }

  @Post(':siteId/reactivate')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Réactive un site désactivé, si aucun site actif ne porte déjà son nom.' })
  @ApiOkResponse({ schema: SITE_SCHEMA, headers: ETAG_HEADER })
  async reactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Param('siteId', new ZodValidationPipe(uuidSchema)) siteId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReactivateAgencySiteResponse> {
    const site = await this.reactivateSite.handle({ actorId: user.id, agencyId, siteId });
    response.setHeader('ETag', etagOf(site.version));
    return site;
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Liste les sites de l’agence, actifs d’abord puis désactivés, pour tout membre actif.' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'De 1 à 100, 20 par défaut.' })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'La valeur `nextCursor` de la page précédente.' })
  @ApiOkResponse({ schema: { type: 'object', required: ['items', 'nextCursor', 'hasMore'], properties: { items: { type: 'array', items: SITE_SCHEMA }, nextCursor: { type: 'string', format: 'uuid', nullable: true }, hasMore: { type: 'boolean' } } } })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Query('limit', new ZodValidationPipe(limitParam)) limit: number,
    @Query('cursor', new ZodValidationPipe(cursorParam)) cursor: string | null,
  ): Promise<ListAgencySitesResponse> {
    return this.listSites.handle({ agencyId, userId: user.id, limit, cursor });
  }
}
