import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedUser } from '@modules/identity/application/read-models/authenticated-user.read-model';
import { CurrentUser } from '@modules/identity/presentation/http/decorators/current-user.decorator';
import { AccessTokenGuard } from '@modules/identity/presentation/http/guards/access-token.guard';
import { CommandHandler } from '@shared/application/command-handler';
import { TransactionalCommandHandlerFactory } from '@shared/infrastructure/persistence/typeorm/transactional-command-handler.factory';
import { IdempotencyKey } from '@shared/presentation/http/idempotency-key.decorator';
import { uuidSchema, ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe';
import { AcceptQuoteCommand } from '../../application/commands/accept-quote/accept-quote.command';
import { AcceptQuoteHandler } from '../../application/commands/accept-quote/accept-quote.handler';
import { AcceptQuoteResponse } from '../../application/commands/accept-quote/accept-quote.response';
import { IssueQuoteCommand } from '../../application/commands/issue-quote/issue-quote.command';
import { IssueQuoteHandler } from '../../application/commands/issue-quote/issue-quote.handler';
import { IssueQuoteResponse } from '../../application/commands/issue-quote/issue-quote.response';
import { QuoteCursor } from '../../application/ports/read-quote.repository';
import { GetQuoteHandler } from '../../application/queries/get-quote/get-quote.handler';
import { GetQuoteResponse } from '../../application/queries/get-quote/get-quote.response';
import { ListQuotesHandler } from '../../application/queries/list-quotes/list-quotes.handler';
import { ListQuotesResponse } from '../../application/queries/list-quotes/list-quotes.response';
import { rawParcelsOf } from './dto/preview-quote.request';
import { issueQuoteRequest, noBody, quotesCursorParam, quotesLimitParam } from './dto/quote.request';

const PARCEL_BODY = { type: 'object', required: ['weight'], additionalProperties: false, properties: { weight: { type: 'string', example: '0,8 kg', description: 'Avec son unité explicite : `kg` ou `g`, de plus de 0 à 1 000 kg.' }, dimensions: { type: 'object', nullable: true, required: ['length', 'width', 'height', 'unit'], additionalProperties: false, properties: { length: { type: 'integer', minimum: 1, maximum: 500 }, width: { type: 'integer', minimum: 1, maximum: 500 }, height: { type: 'integer', minimum: 1, maximum: 500 }, unit: { type: 'string', enum: ['cm'] } } } } };
const ISSUE_BODY = {
  type: 'object',
  required: ['recipient', 'zoneId', 'parcels'],
  additionalProperties: false,
  properties: {
    recipient: { type: 'object', required: ['name'], additionalProperties: false, properties: { name: { type: 'string', minLength: 2, maxLength: 120 }, phone: { type: 'string', nullable: true, example: '+237 699 00 11 22', description: 'Facultatif : `+237` puis 9 chiffres commençant par 2 ou 6.' } } },
    zoneId: { type: 'string', format: 'uuid', description: 'Une zone active de l’agence.' },
    parcels: { type: 'array', minItems: 1, maxItems: 20, items: PARCEL_BODY },
    manualPrice: { type: 'object', nullable: true, required: ['price', 'reason'], additionalProperties: false, properties: { price: { type: 'integer', minimum: 1, maximum: 10000000, description: 'Francs CFA (XAF) entiers, retenus à la place du prix calculé.' }, reason: { type: 'string', minLength: 3, maxLength: 300 } } },
  },
};
const STORED_PARCEL = { type: 'object', required: ['weightGrams', 'dimensions', 'taxableGrams', 'price'], properties: { weightGrams: { type: 'integer' }, dimensions: { type: 'object', nullable: true, properties: { length: { type: 'integer' }, width: { type: 'integer' }, height: { type: 'integer' } } }, taxableGrams: { type: 'integer', nullable: true }, price: { type: 'integer', nullable: true, description: '`null` : colis hors barème ou zone sans tarif.' } } };
const STATE = { type: 'string', enum: ['issued', 'accepted', 'expired'], description: '`expired` est dérivé de la date de validité, jamais enregistré.' };
const ZONE = { type: 'object', required: ['id', 'city', 'district'], properties: { id: { type: 'string', format: 'uuid' }, city: { type: 'string' }, district: { type: 'string', nullable: true } } };
const QUOTE_SCHEMA = {
  type: 'object',
  required: ['id', 'reference', 'status', 'recipient', 'zone', 'parcels', 'currency', 'rateCardVersion', 'pricing', 'calculatedTotal', 'manualPrice', 'manualPriceReason', 'total', 'issuedAt', 'issuedBy', 'validUntil', 'acceptedAt', 'acceptedBy'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    reference: { type: 'string', example: 'DEV-2026-000001' },
    status: STATE,
    recipient: { type: 'object', required: ['name', 'phone'], properties: { name: { type: 'string' }, phone: { type: 'string', nullable: true } } },
    zone: ZONE,
    parcels: { type: 'array', items: STORED_PARCEL },
    currency: { type: 'string', enum: ['XAF'] },
    rateCardVersion: { type: 'integer', nullable: true, description: 'La version de la grille utilisée ; `null` pour une agence sans grille.' },
    pricing: { type: 'string', enum: ['priced', 'out_of_scale', 'no_tariff'] },
    calculatedTotal: { type: 'integer', nullable: true },
    manualPrice: { type: 'integer', nullable: true },
    manualPriceReason: { type: 'string', nullable: true },
    total: { type: 'integer', description: 'Ce à quoi le devis engage l’agence : le prix retenu s’il y en a un, le total calculé sinon.' },
    issuedAt: { type: 'string', format: 'date-time' },
    issuedBy: { type: 'string', format: 'uuid' },
    validUntil: { type: 'string', format: 'date-time', description: 'Sept jours après l’émission, borne incluse.' },
    acceptedAt: { type: 'string', format: 'date-time', nullable: true },
    acceptedBy: { type: 'string', format: 'uuid', nullable: true },
  },
};
const SUMMARY_SCHEMA = { type: 'object', required: ['id', 'reference', 'status', 'recipientName', 'zone', 'currency', 'total', 'issuedAt', 'validUntil', 'acceptedAt'], properties: { id: { type: 'string', format: 'uuid' }, reference: { type: 'string' }, status: STATE, recipientName: { type: 'string' }, zone: ZONE, currency: { type: 'string', enum: ['XAF'] }, total: { type: 'integer' }, issuedAt: { type: 'string', format: 'date-time' }, validUntil: { type: 'string', format: 'date-time' }, acceptedAt: { type: 'string', format: 'date-time', nullable: true } } };

@ApiTags('quotes')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('agencies/:agencyId/quotes')
export class QuoteController {
  private readonly issueQuote: CommandHandler<IssueQuoteCommand, IssueQuoteResponse>;
  private readonly acceptQuote: CommandHandler<AcceptQuoteCommand, AcceptQuoteResponse>;

  constructor(
    issue: IssueQuoteHandler,
    accept: AcceptQuoteHandler,
    private readonly getQuote: GetQuoteHandler,
    private readonly listQuotes: ListQuotesHandler,
    transactional: TransactionalCommandHandlerFactory,
  ) {
    this.issueQuote = transactional.create(issue);
    this.acceptQuote = transactional.create(accept);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Émet un devis pour un destinataire (tout membre actif, agent compris) : prix calculé avec la version de la grille en vigueur, copié dans le devis avec le libellé de la zone et les colis, valable sept jours. Un prix retenu motivé remplace le calcul ; il est indispensable hors barème ou sans tarif (400 QUOTE_NOT_PRICEABLE). Zone retirée : 409 ZONE_RETIRED ; livraison non active : 409 DELIVERY_NOT_ACTIVE ; zone d’une autre agence ou inconnue : 404. Avec `Idempotency-Key`, un second envoi identique renvoie le même devis (200) ; un contenu différent : 409 IDEMPOTENCY_KEY_REUSED.' })
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'De 8 à 128 caractères ASCII visibles, propre à l’utilisateur et à l’agence.' })
  @ApiBody({ schema: ISSUE_BODY })
  @ApiCreatedResponse({ schema: QUOTE_SCHEMA })
  @ApiOkResponse({ description: 'Rejeu d’une clé d’idempotence déjà utilisée pour ce même contenu : le devis d’origine, rien n’est écrit.', schema: QUOTE_SCHEMA })
  async issue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @IdempotencyKey() idempotencyKey: string | null,
    @Body(new ZodValidationPipe(issueQuoteRequest)) body: z.output<typeof issueQuoteRequest>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<GetQuoteResponse> {
    const result = await this.issueQuote.handle({
      actorId: user.id,
      agencyId,
      recipientName: body.recipient.name,
      recipientPhone: body.recipient.phone ?? null,
      zoneId: body.zoneId,
      parcels: rawParcelsOf(body.parcels),
      manual: body.manualPrice ? { price: body.manualPrice.price, reason: body.manualPrice.reason } : null,
      idempotencyKey,
    });
    response.status(result.replayed ? 200 : 201);
    return result.quote;
  }

  @Post(':quoteId/accept')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Enregistre l’acceptation du devis par le destinataire (tout membre actif, au nom du client) : le prix est figé, aucune commande n’est créée. Action sans contenu. Déjà accepté : 409 QUOTE_ALREADY_ACCEPTED ; expiré : 409 QUOTE_EXPIRED ; zone retirée : 409 ZONE_RETIRED ; livraison non active : 409 DELIVERY_NOT_ACTIVE ; devis d’une autre agence ou inconnu : 404.' })
  @ApiOkResponse({ schema: QUOTE_SCHEMA })
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Param('quoteId', new ZodValidationPipe(uuidSchema)) quoteId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the pipe is the point: it refuses any body
    @Body(new ZodValidationPipe(noBody)) _body: z.output<typeof noBody>,
  ): Promise<AcceptQuoteResponse> {
    return this.acceptQuote.handle({ actorId: user.id, agencyId, quoteId });
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Liste les devis de l’agence, du plus récent au plus ancien, pour tout membre actif. Résumés seulement : le détail d’un devis se lit par sa route.' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'De 1 à 100, 20 par défaut.' })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'La valeur `nextCursor` de la page précédente.' })
  @ApiOkResponse({ schema: { type: 'object', required: ['items', 'nextCursor', 'hasMore'], properties: { items: { type: 'array', items: SUMMARY_SCHEMA }, nextCursor: { type: 'string', nullable: true }, hasMore: { type: 'boolean' } } } })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Query('limit', new ZodValidationPipe(quotesLimitParam)) limit: number,
    @Query('cursor', new ZodValidationPipe(quotesCursorParam)) cursor: QuoteCursor | null,
  ): Promise<ListQuotesResponse> {
    return this.listQuotes.handle({ agencyId, userId: user.id, limit, cursor });
  }

  @Get(':quoteId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Lit un devis en entier (destinataire compris, donnée privée de l’agence), pour tout membre actif. Devis d’une autre agence ou inconnu : 404.' })
  @ApiOkResponse({ schema: QUOTE_SCHEMA })
  read(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Param('quoteId', new ZodValidationPipe(uuidSchema)) quoteId: string,
  ): Promise<GetQuoteResponse> {
    return this.getQuote.handle({ agencyId, userId: user.id, quoteId });
  }
}
