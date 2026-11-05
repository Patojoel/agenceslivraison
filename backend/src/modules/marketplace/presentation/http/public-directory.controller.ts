import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { publicRateLimitPerMinute } from '@config/env.schema';
import { ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe';
import { GetPublicAgencyHandler } from '../../application/queries/get-public-agency/get-public-agency.handler';
import { GetPublicAgencyResponse } from '../../application/queries/get-public-agency/get-public-agency.response';
import { SearchPublicAgenciesHandler } from '../../application/queries/search-public-agencies/search-public-agencies.handler';
import { SearchPublicAgenciesResponse } from '../../application/queries/search-public-agencies/search-public-agencies.response';
import { PublicSearchQuery, publicSearchQuery } from './dto/public-directory.request';

const CAPABILITIES = { type: 'array', items: { type: 'string', enum: ['delivery', 'storage'] } };
const SUMMARY_SCHEMA = {
  type: 'object',
  required: ['slug', 'tradeName', 'verification', 'capabilities', 'hybrid', 'cities'],
  properties: {
    slug: { type: 'string', description: 'Adresse publique de la fiche.' },
    tradeName: { type: 'string' },
    verification: { type: 'string', enum: ['unverified'], description: 'Toujours « non vérifiée » jusqu’à l’approbation par la plateforme (B10).' },
    capabilities: { ...CAPABILITIES, description: 'Capacités actives.' },
    hybrid: { type: 'boolean', description: 'Livraison et stockage actifs.' },
    cities: { type: 'array', items: { type: 'string' }, description: 'Villes des zones et des sites actifs, une fois chacune, par ordre alphabétique.' },
  },
};
const DETAIL_SCHEMA = {
  type: 'object',
  required: ['slug', 'tradeName', 'description', 'verification', 'capabilities', 'hybrid', 'zones', 'siteCities', 'pricing', 'publishedAt'],
  properties: {
    slug: { type: 'string' },
    tradeName: { type: 'string' },
    description: { type: 'string', nullable: true, description: 'Texte brut, balisage éventuel conservé tel que saisi : le client l’échappe à l’affichage.' },
    verification: { type: 'string', enum: ['unverified'] },
    capabilities: CAPABILITIES,
    hybrid: { type: 'boolean' },
    zones: {
      type: 'array',
      items: {
        type: 'object',
        required: ['city', 'district', 'startingPrice'],
        properties: {
          city: { type: 'string' },
          district: { type: 'string', nullable: true, description: '`null` : la zone couvre la ville entière.' },
          startingPrice: { type: 'integer', nullable: true, description: 'Prix « à partir de » en XAF (le plus bas de la grille en vigueur), non garanti sans devis ; `null` : sur devis.' },
        },
      },
    },
    siteCities: { type: 'array', items: { type: 'string' } },
    pricing: {
      type: 'object',
      required: ['currency', 'notice'],
      properties: {
        currency: { type: 'string', enum: ['XAF'] },
        notice: { type: 'string', enum: ['indicative_not_guaranteed', 'on_quote'], description: '`indicative_not_guaranteed` : « Tarifs indicatifs, non garantis sans devis » ; `on_quote` : « tarifs sur devis ».' },
      },
    },
    publishedAt: { type: 'string', format: 'date-time' },
  },
};

/**
 * The public directory: no authentication (no guard, an `Authorization` header is ignored), nothing written, and the limit of
 * 60 requests a minute and per address on each route (the throttler is in memory, per instance, and counts the address of the
 * socket: limits B1.11 and B10.19). `no-store`: a withdrawn fiche is gone at the next read, and no shared cache keeps one.
 */
@ApiTags('public-directory')
@Controller('public/agencies')
@Throttle({ default: { limit: () => publicRateLimitPerMinute(), ttl: 60000 } })
export class PublicDirectoryController {
  constructor(
    private readonly search: SearchPublicAgenciesHandler,
    private readonly fiche: GetPublicAgencyHandler,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Annuaire public des agences : fiches visibles seulement, par ordre alphabétique du nom (sans casse ni accents) puis de l’adresse. Sans authentification, 60 requêtes par minute et par adresse (429 au-delà). Tout paramètre inconnu ou invalide : 400.' })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Texte contenu dans le nom, sans casse ni accents (2 à 80 caractères).' })
  @ApiQuery({ name: 'city', required: false, type: String, description: 'Ville d’une zone active ou d’un site actif (2 à 80 caractères).' })
  @ApiQuery({ name: 'district', required: false, type: String, description: 'Quartier d’une zone active (exige `city`) ; une zone qui couvre la ville entière convient à tout quartier ; les sites n’ont pas de quartier.' })
  @ApiQuery({ name: 'capability', required: false, isArray: true, enum: ['delivery', 'storage'], description: 'Répétable ; les deux ensemble : agences hybrides seulement.' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'De 1 à 50, 20 par défaut.' })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'La valeur `nextCursor` de la page précédente, avec les mêmes paramètres de recherche.' })
  @ApiOkResponse({ schema: { type: 'object', required: ['items', 'nextCursor', 'hasMore'], properties: { items: { type: 'array', items: SUMMARY_SCHEMA }, nextCursor: { type: 'string', nullable: true }, hasMore: { type: 'boolean' } } } })
  @ApiResponse({ status: 400, description: 'Paramètre inconnu, hors bornes ou curseur invalide (Problem Details).' })
  @ApiResponse({ status: 429, description: 'Plus de 60 requêtes en une minute depuis cette adresse (Problem Details).' })
  list(@Query(new ZodValidationPipe(publicSearchQuery)) query: PublicSearchQuery): Promise<SearchPublicAgenciesResponse> {
    const { capability, ...rest } = query;
    return this.search.handle({ ...rest, capabilities: capability === undefined ? undefined : Array.isArray(capability) ? capability : [capability] });
  }

  @Get(':slug')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Fiche publique d’une agence par son adresse. Sans authentification, 60 requêtes par minute et par adresse. Adresse inconnue, mal formée, fiche retirée ou masquée : le même 404.' })
  @ApiParam({ name: 'slug', type: String })
  @ApiOkResponse({ schema: DETAIL_SCHEMA })
  @ApiResponse({ status: 404, description: 'Introuvable, toujours de la même façon (Problem Details).' })
  @ApiResponse({ status: 429, description: 'Plus de 60 requêtes en une minute depuis cette adresse (Problem Details).' })
  read(@Param('slug') slug: string): Promise<GetPublicAgencyResponse> {
    return this.fiche.handle({ slug });
  }
}
