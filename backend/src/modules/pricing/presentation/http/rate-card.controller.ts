import { Body, Controller, Get, Header, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
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
import { CreateRateCardCommand } from '../../application/commands/create-rate-card/create-rate-card.command';
import { CreateRateCardHandler } from '../../application/commands/create-rate-card/create-rate-card.handler';
import { CreateRateCardResponse } from '../../application/commands/create-rate-card/create-rate-card.response';
import { PublishRateCardVersionCommand } from '../../application/commands/publish-rate-card-version/publish-rate-card-version.command';
import { PublishRateCardVersionHandler } from '../../application/commands/publish-rate-card-version/publish-rate-card-version.handler';
import { PublishRateCardVersionResponse } from '../../application/commands/publish-rate-card-version/publish-rate-card-version.response';
import { GetRateCardVersionHandler } from '../../application/queries/get-rate-card-version/get-rate-card-version.handler';
import { GetRateCardVersionResponse } from '../../application/queries/get-rate-card-version/get-rate-card-version.response';
import { GetRateCardHandler } from '../../application/queries/get-rate-card/get-rate-card.handler';
import { GetRateCardResponse } from '../../application/queries/get-rate-card/get-rate-card.response';
import { ListRateCardVersionsHandler } from '../../application/queries/list-rate-card-versions/list-rate-card-versions.handler';
import { ListRateCardVersionsResponse } from '../../application/queries/list-rate-card-versions/list-rate-card-versions.response';
import { rateCardRequest, versionNumberParam, versionsCursorParam, versionsLimitParam } from './dto/rate-card.request';

const TIER_SCHEMA = { type: 'object', required: ['upTo', 'price'], additionalProperties: false, properties: { upTo: { type: 'string', example: '1 kg', description: 'Borne supérieure incluse, avec son unité explicite : `kg` ou `g`, au gramme près, de 1 g à 1 000 kg.' }, price: { type: 'integer', minimum: 1, maximum: 10000000, description: 'Francs CFA (XAF) entiers, taxes comprises.' } } };
const RATE_CARD_BODY_SCHEMA = {
  type: 'object',
  required: ['lines'],
  additionalProperties: false,
  properties: {
    currency: { type: 'string', enum: ['XAF'] },
    volumetricDivisor: { type: 'integer', nullable: true, minimum: 1000, maximum: 10000, description: 'Facultatif : centimètres cubes par kilogramme volumétrique.' },
    lines: { type: 'array', minItems: 1, maxItems: 100, items: { type: 'object', required: ['zoneId', 'tiers'], additionalProperties: false, properties: { zoneId: { type: 'string', format: 'uuid', description: 'Une zone active de l’agence, une seule ligne par zone.' }, tiers: { type: 'array', minItems: 1, maxItems: 20, description: 'Bornes strictement croissantes.', items: TIER_SCHEMA } } } },
  },
};
const LINE_SCHEMA = {
  type: 'object',
  required: ['zoneId', 'city', 'district', 'zoneStatus', 'tiers'],
  properties: {
    zoneId: { type: 'string', format: 'uuid' },
    city: { type: 'string', nullable: true },
    district: { type: 'string', nullable: true },
    zoneStatus: { type: 'string', enum: ['active', 'retired', 'unknown'], description: 'État actuel de la zone ; une zone retirée garde ses tranches dans la version.' },
    tiers: { type: 'array', items: { type: 'object', required: ['upToGrams', 'price'], properties: { upToGrams: { type: 'integer' }, price: { type: 'integer' } } } },
  },
};
const VERSION_SCHEMA = {
  type: 'object',
  required: ['number', 'createdAt', 'createdBy', 'volumetricDivisor', 'currency', 'zones'],
  properties: { number: { type: 'integer' }, createdAt: { type: 'string', format: 'date-time' }, createdBy: { type: 'string', format: 'uuid' }, volumetricDivisor: { type: 'integer', nullable: true }, currency: { type: 'string', enum: ['XAF'] }, zones: { type: 'array', items: LINE_SCHEMA } },
};
const RATE_CARD_SCHEMA = { type: 'object', required: ['id', 'version'], properties: { id: { type: 'string', format: 'uuid' }, version: VERSION_SCHEMA } };
const ETAG_HEADER = { ETag: { description: 'Le numéro de la version en vigueur, entre guillemets (`"3"`).', schema: { type: 'string' } } };

@ApiTags('rate-card')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('agencies/:agencyId/rate-card')
export class RateCardController {
  private readonly createRateCard: CommandHandler<CreateRateCardCommand, CreateRateCardResponse>;
  private readonly publishVersion: CommandHandler<PublishRateCardVersionCommand, PublishRateCardVersionResponse>;

  constructor(
    create: CreateRateCardHandler,
    publish: PublishRateCardVersionHandler,
    private readonly getRateCard: GetRateCardHandler,
    private readonly getVersion: GetRateCardVersionHandler,
    private readonly listVersions: ListRateCardVersionsHandler,
    transactional: TransactionalCommandHandlerFactory,
  ) {
    this.createRateCard = transactional.create(create);
    this.publishVersion = transactional.create(publish);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Crée la grille de livraison de l’agence (propriétaire ou administrateur) : version 1, en vigueur aussitôt. Une seule grille par agence : une seconde création répond 409 RATE_CARD_ALREADY_EXISTS ; on publie alors une nouvelle version.' })
  @ApiBody({ schema: RATE_CARD_BODY_SCHEMA })
  @ApiCreatedResponse({ schema: RATE_CARD_SCHEMA, headers: ETAG_HEADER })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Body(new ZodValidationPipe(rateCardRequest)) body: z.output<typeof rateCardRequest>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CreateRateCardResponse> {
    const card = await this.createRateCard.handle({ actorId: user.id, agencyId, volumetricDivisor: body.volumetricDivisor ?? null, lines: body.lines });
    response.setHeader('ETag', etagOf(card.version.number));
    return card;
  }

  @Post('versions')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Publie une nouvelle version complète (propriétaire ou administrateur), en vigueur aussitôt ; les versions précédentes ne changent jamais. 201 avec la nouvelle version ; 200 sans rien écrire si le barème est identique à celui en vigueur. Numéro de base périmé : 409 STALE_RATE_CARD_VERSION.' })
  @ApiHeader({ name: 'If-Match', required: true, description: 'Le numéro de la version en vigueur que l’auteur a lue, nu (`3`) ou entre guillemets (`"3"`). Absent : 428. Mal formé : 400. Périmé : 409.' })
  @ApiBody({ schema: RATE_CARD_BODY_SCHEMA })
  @ApiCreatedResponse({ schema: RATE_CARD_SCHEMA, headers: ETAG_HEADER })
  @ApiOkResponse({ description: 'Barème identique à la version en vigueur : aucune version créée.', schema: RATE_CARD_SCHEMA, headers: ETAG_HEADER })
  async publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @IfMatchVersion() expectedVersion: number,
    @Body(new ZodValidationPipe(rateCardRequest)) body: z.output<typeof rateCardRequest>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<GetRateCardResponse> {
    const result = await this.publishVersion.handle({ actorId: user.id, agencyId, expectedVersion, volumetricDivisor: body.volumetricDivisor ?? null, lines: body.lines });
    response.status(result.changed ? 201 : 200);
    response.setHeader('ETag', etagOf(result.rateCard.version.number));
    return result.rateCard;
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Lit la version en vigueur et ses lignes, pour tout membre actif. 404 si l’agence n’a pas encore de grille.' })
  @ApiOkResponse({ schema: RATE_CARD_SCHEMA, headers: ETAG_HEADER })
  async read(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<GetRateCardResponse> {
    const card = await this.getRateCard.handle({ agencyId, userId: user.id });
    response.setHeader('ETag', etagOf(card.version.number));
    return card;
  }

  @Get('versions')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Liste l’historique des versions, de la plus récente à la plus ancienne, pour tout membre actif. Le barème d’une version se lit par sa route.' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'De 1 à 50, 20 par défaut.' })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'La valeur `nextCursor` de la page précédente.' })
  @ApiOkResponse({ schema: { type: 'object', required: ['items', 'nextCursor', 'hasMore'], properties: { items: { type: 'array', items: { type: 'object', required: ['number', 'createdAt', 'createdBy', 'volumetricDivisor', 'zoneCount'], properties: { number: { type: 'integer' }, createdAt: { type: 'string', format: 'date-time' }, createdBy: { type: 'string', format: 'uuid' }, volumetricDivisor: { type: 'integer', nullable: true }, zoneCount: { type: 'integer' } } } }, nextCursor: { type: 'string', nullable: true }, hasMore: { type: 'boolean' } } } })
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Query('limit', new ZodValidationPipe(versionsLimitParam)) limit: number,
    @Query('cursor', new ZodValidationPipe(versionsCursorParam)) cursor: number | null,
  ): Promise<ListRateCardVersionsResponse> {
    return this.listVersions.handle({ agencyId, userId: user.id, limit, cursor });
  }

  @Get('versions/:number')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Lit une version telle qu’elle a été écrite, avec son barème, pour tout membre actif. Numéro inconnu : 404.' })
  @ApiOkResponse({ schema: RATE_CARD_SCHEMA })
  version(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Param('number', new ZodValidationPipe(versionNumberParam)) number: number,
  ): Promise<GetRateCardVersionResponse> {
    return this.getVersion.handle({ agencyId, userId: user.id, number });
  }
}
