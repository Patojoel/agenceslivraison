import { Body, Controller, Get, Header, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedUser } from '@modules/identity/application/read-models/authenticated-user.read-model';
import { CurrentUser } from '@modules/identity/presentation/http/decorators/current-user.decorator';
import { AccessTokenGuard } from '@modules/identity/presentation/http/guards/access-token.guard';
import { CommandHandler } from '@shared/application/command-handler';
import { TransactionalCommandHandlerFactory } from '@shared/infrastructure/persistence/typeorm/transactional-command-handler.factory';
import { IdempotencyKey } from '@shared/presentation/http/idempotency-key.decorator';
import { etagOf, IfMatchVersion } from '@shared/presentation/http/if-match-version.decorator';
import { uuidSchema, ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe';
import { CreateAgencyCommand } from '../../application/commands/create-agency/create-agency.command';
import { CreateAgencyHandler } from '../../application/commands/create-agency/create-agency.handler';
import { CreateAgencyResponse } from '../../application/commands/create-agency/create-agency.response';
import { UpdateAgencyIdentityCommand } from '../../application/commands/update-agency-identity/update-agency-identity.command';
import { UpdateAgencyIdentityHandler } from '../../application/commands/update-agency-identity/update-agency-identity.handler';
import { UpdateAgencyIdentityResponse } from '../../application/commands/update-agency-identity/update-agency-identity.response';
import { UpdateAgencyProfileCommand } from '../../application/commands/update-agency-profile/update-agency-profile.command';
import { UpdateAgencyProfileHandler } from '../../application/commands/update-agency-profile/update-agency-profile.handler';
import { UpdateAgencyProfileResponse } from '../../application/commands/update-agency-profile/update-agency-profile.response';
import { GetAgencyHandler } from '../../application/queries/get-agency/get-agency.handler';
import { GetAgencyResponse } from '../../application/queries/get-agency/get-agency.response';
import { GetAgencyOnboardingHandler } from '../../application/queries/get-agency-onboarding/get-agency-onboarding.handler';
import { GetAgencyOnboardingResponse } from '../../application/queries/get-agency-onboarding/get-agency-onboarding.response';
import { createAgencyRequest } from './dto/create-agency.request';
import { updateAgencyIdentityRequest } from './dto/update-agency-identity.request';
import { updateAgencyProfileRequest } from './dto/update-agency-profile.request';

const PREREQUISITE_CODES = ['legal_name', 'headquarters_city', 'headquarters_address', 'primary_phone', 'active_capability', 'active_site'];

const nullableText = { type: 'string', nullable: true };
const IDENTITY_SCHEMA = {
  type: 'object',
  required: ['legalName', 'headquartersCity', 'headquartersAddress', 'primaryPhone', 'contactEmail', 'rccm', 'niu'],
  properties: { legalName: nullableText, headquartersCity: nullableText, headquartersAddress: nullableText, primaryPhone: nullableText, contactEmail: nullableText, rccm: nullableText, niu: nullableText },
};
const IDENTITY_BODY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    legalName: { type: 'string', minLength: 2, maxLength: 200 },
    headquartersCity: { type: 'string', minLength: 2, maxLength: 80 },
    headquartersAddress: { type: 'string', minLength: 5, maxLength: 300 },
    primaryPhone: { type: 'string', description: '+237 puis 9 chiffres commençant par 2 ou 6 ; les espaces sont tolérés, +237 est facultatif à la saisie.' },
    contactEmail: { type: 'string', nullable: true },
    rccm: { type: 'string', nullable: true, minLength: 5, maxLength: 40 },
    niu: { type: 'string', nullable: true, description: '14 caractères alphanumériques.' },
  },
};
const AGENCY_SCHEMA = {
  type: 'object',
  required: ['id', 'status', 'tradeName', 'description', 'identity', 'version'],
  properties: { id: { type: 'string', format: 'uuid' }, status: { type: 'string', enum: ['draft', 'submitted'] }, tradeName: { type: 'string' }, description: nullableText, identity: IDENTITY_SCHEMA, version: { type: 'integer' } },
};

@ApiTags('agencies')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('agencies')
export class AgencyController {
  private readonly createAgency: CommandHandler<CreateAgencyCommand, CreateAgencyResponse>;
  private readonly updateIdentity: CommandHandler<UpdateAgencyIdentityCommand, UpdateAgencyIdentityResponse>;
  private readonly updateProfile: CommandHandler<UpdateAgencyProfileCommand, UpdateAgencyProfileResponse>;

  constructor(
    create: CreateAgencyHandler,
    identity: UpdateAgencyIdentityHandler,
    profile: UpdateAgencyProfileHandler,
    private readonly getOnboarding: GetAgencyOnboardingHandler,
    private readonly getAgency: GetAgencyHandler,
    transactional: TransactionalCommandHandlerFactory,
  ) {
    this.createAgency = transactional.create(create);
    this.updateIdentity = transactional.create(identity);
    this.updateProfile = transactional.create(profile);
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

  @Get(':agencyId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Lit l’agence : statut, profil, identité et version (aussi dans l’en-tête ETag).' })
  @ApiOkResponse({ schema: AGENCY_SCHEMA, headers: { ETag: { description: 'La version de l’agence, entre guillemets (`"3"`).', schema: { type: 'string' } } } })
  async read(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<GetAgencyResponse> {
    const agency = await this.getAgency.handle({ agencyId, userId: user.id });
    response.setHeader('ETag', etagOf(agency.version));
    return agency;
  }

  @Patch(':agencyId/identity')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Complète l’identité de l’agence (brouillon seulement). Mise à jour partielle.' })
  @ApiHeader({ name: 'If-Match', required: true, description: 'La version lue, nue (`3`) ou entre guillemets (`"3"`). Absente : 428. Périmée : 409.' })
  @ApiBody({ schema: IDENTITY_BODY_SCHEMA })
  @ApiOkResponse({ schema: { type: 'object', required: ['version', 'identity'], properties: { version: { type: 'integer' }, identity: IDENTITY_SCHEMA } }, headers: { ETag: { description: 'La nouvelle version.', schema: { type: 'string' } } } })
  async completeIdentity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @IfMatchVersion() expectedVersion: number,
    @Body(new ZodValidationPipe(updateAgencyIdentityRequest)) body: z.output<typeof updateAgencyIdentityRequest>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UpdateAgencyIdentityResponse> {
    const result = await this.updateIdentity.handle({ actorId: user.id, agencyId, expectedVersion, changes: body });
    response.setHeader('ETag', etagOf(result.version));
    return result;
  }

  @Patch(':agencyId/profile')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Modifie le nom commercial et la description, brouillon ou soumise. Mise à jour partielle.' })
  @ApiHeader({ name: 'If-Match', required: true, description: 'La version lue, nue (`3`) ou entre guillemets (`"3"`). Absente : 428. Périmée : 409.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { tradeName: { type: 'string', minLength: 2, maxLength: 120 }, description: { type: 'string', nullable: true, maxLength: 1000 } } } })
  @ApiOkResponse({ schema: { type: 'object', required: ['version', 'tradeName', 'description'], properties: { version: { type: 'integer' }, tradeName: { type: 'string' }, description: { type: 'string', nullable: true } } }, headers: { ETag: { description: 'La nouvelle version.', schema: { type: 'string' } } } })
  async editProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    @IfMatchVersion() expectedVersion: number,
    @Body(new ZodValidationPipe(updateAgencyProfileRequest)) body: z.output<typeof updateAgencyProfileRequest>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UpdateAgencyProfileResponse> {
    const result = await this.updateProfile.handle({ actorId: user.id, agencyId, expectedVersion, changes: body });
    response.setHeader('ETag', etagOf(result.version));
    return result;
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
