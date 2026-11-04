import { Body, Controller, Header, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthenticatedUser } from '@modules/identity/application/read-models/authenticated-user.read-model';
import { CurrentUser } from '@modules/identity/presentation/http/decorators/current-user.decorator';
import { AccessTokenGuard } from '@modules/identity/presentation/http/guards/access-token.guard';
import { uuidSchema, ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe';
import { PreviewQuoteHandler } from '../../application/queries/preview-quote/preview-quote.handler';
import { PreviewQuoteResponse } from '../../application/queries/preview-quote/preview-quote.response';
import { previewQuoteRequest, rawParcelsOf } from './dto/preview-quote.request';

@ApiTags('quotes')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('agencies/:agencyId/quotes')
export class QuotePreviewController {
  constructor(private readonly preview: PreviewQuoteHandler) {}

  @Post('preview')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Simule le prix d’une livraison vers une zone de l’agence, avec la version de la grille en vigueur, pour tout membre actif. Rien n’est enregistré. Sans tarif pour la zone (ou sans grille) : 200 avec le statut `no_tariff`. Colis hors barème : `out_of_scale`, sans total. Zone retirée : 409 ZONE_RETIRED.' })
  @ApiBody({ schema: { type: 'object', required: ['zoneId', 'parcels'], additionalProperties: false, properties: { zoneId: { type: 'string', format: 'uuid' }, parcels: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', required: ['weight'], additionalProperties: false, properties: { weight: { type: 'string', example: '0,8 kg', description: 'Avec son unité explicite : `kg` ou `g`, de plus de 0 à 1 000 kg.' }, dimensions: { type: 'object', nullable: true, required: ['length', 'width', 'height', 'unit'], additionalProperties: false, properties: { length: { type: 'integer', minimum: 1, maximum: 500 }, width: { type: 'integer', minimum: 1, maximum: 500 }, height: { type: 'integer', minimum: 1, maximum: 500 }, unit: { type: 'string', enum: ['cm'] } } } } } } } } })
  @ApiOkResponse({ schema: { type: 'object', required: ['currency', 'indicative', 'notice', 'status', 'version', 'zoneId', 'parcels', 'total'], properties: { currency: { type: 'string', enum: ['XAF'] }, indicative: { type: 'boolean', enum: [true] }, notice: { type: 'string' }, status: { type: 'string', enum: ['priced', 'out_of_scale', 'no_tariff'] }, version: { type: 'integer', nullable: true }, zoneId: { type: 'string', format: 'uuid' }, parcels: { type: 'array', items: { type: 'object', required: ['taxableGrams', 'price'], properties: { taxableGrams: { type: 'integer' }, price: { type: 'integer', nullable: true } } } }, total: { type: 'integer', nullable: true } } } })
  simulate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Body(new ZodValidationPipe(previewQuoteRequest)) body: z.output<typeof previewQuoteRequest>,
  ): Promise<PreviewQuoteResponse> {
    return this.preview.handle({
      agencyId,
      userId: user.id,
      zoneId: body.zoneId,
      parcels: rawParcelsOf(body.parcels),
    });
  }
}
