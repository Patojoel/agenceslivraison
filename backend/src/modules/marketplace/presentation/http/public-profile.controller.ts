import { Body, Controller, Get, Header, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthenticatedUser } from '@modules/identity/application/read-models/authenticated-user.read-model';
import { CurrentUser } from '@modules/identity/presentation/http/decorators/current-user.decorator';
import { AccessTokenGuard } from '@modules/identity/presentation/http/guards/access-token.guard';
import { CommandHandler } from '@shared/application/command-handler';
import { TransactionalCommandHandlerFactory } from '@shared/infrastructure/persistence/typeorm/transactional-command-handler.factory';
import { uuidSchema, ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe';
import { PublishPublicProfileCommand } from '../../application/commands/publish-public-profile/publish-public-profile.command';
import { PublishPublicProfileHandler } from '../../application/commands/publish-public-profile/publish-public-profile.handler';
import { PublishPublicProfileResponse } from '../../application/commands/publish-public-profile/publish-public-profile.response';
import { UnpublishPublicProfileCommand } from '../../application/commands/unpublish-public-profile/unpublish-public-profile.command';
import { UnpublishPublicProfileHandler } from '../../application/commands/unpublish-public-profile/unpublish-public-profile.handler';
import { UnpublishPublicProfileResponse } from '../../application/commands/unpublish-public-profile/unpublish-public-profile.response';
import { GetPublicProfileHandler } from '../../application/queries/get-public-profile/get-public-profile.handler';
import { GetPublicProfileResponse } from '../../application/queries/get-public-profile/get-public-profile.response';
import { noBody } from './dto/public-profile.request';

const OBSTACLES = ['agency_not_submitted', 'provisional_trade_name', 'trade_name_not_publishable', 'no_active_capability'];
const STATE_SCHEMA = {
  type: 'object',
  required: ['published', 'slug', 'publishedAt', 'unpublishedAt', 'visible', 'verification', 'obstacles'],
  properties: {
    published: { type: 'boolean', description: 'Le propriétaire a publié la fiche et ne l’a pas retirée.' },
    slug: { type: 'string', nullable: true, description: 'Adresse publique, attribuée à la première publication, stable, jamais réattribuée.' },
    publishedAt: { type: 'string', format: 'date-time', nullable: true },
    unpublishedAt: { type: 'string', format: 'date-time', nullable: true },
    visible: { type: 'boolean', description: 'Publiée et non masquée : ce qu’un visiteur peut trouver.' },
    verification: { type: 'string', enum: ['unverified'], description: 'Toujours « non vérifiée » jusqu’à l’approbation par la plateforme (B10).' },
    obstacles: { type: 'array', items: { type: 'string', enum: OBSTACLES }, description: 'Ce qui masque la fiche publiée, ou empêche d’en publier une.' },
  },
};

@ApiTags('public-profile')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('agencies/:agencyId/public-profile')
export class PublicProfileController {
  private readonly publishProfile: CommandHandler<PublishPublicProfileCommand, PublishPublicProfileResponse>;
  private readonly unpublishProfile: CommandHandler<UnpublishPublicProfileCommand, UnpublishPublicProfileResponse>;

  constructor(
    publish: PublishPublicProfileHandler,
    unpublish: UnpublishPublicProfileHandler,
    private readonly getProfile: GetPublicProfileHandler,
    transactional: TransactionalCommandHandlerFactory,
  ) {
    this.publishProfile = transactional.create(publish);
    this.unpublishProfile = transactional.create(unpublish);
  }

  @Post('publish')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Publie la fiche de l’agence (propriétaire seulement, sans corps). Agence soumise, nom publiable, au moins une capacité active ; mention « non vérifiée ». Conflits : AGENCY_NOT_SUBMITTED, PROVISIONAL_TRADE_NAME, TRADE_NAME_NOT_PUBLISHABLE, NO_ACTIVE_CAPABILITY, PROFILE_ALREADY_PUBLISHED. L’adresse publique est calculée à la première publication.' })
  @ApiOkResponse({ schema: STATE_SCHEMA })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the pipe is the point: it refuses any body
    @Body(new ZodValidationPipe(noBody)) _body: z.output<typeof noBody>,
  ): Promise<PublishPublicProfileResponse> {
    return this.publishProfile.handle({ actorId: user.id, agencyId });
  }

  @Post('unpublish')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Retire la fiche (propriétaire seulement, sans corps). L’adresse reste réservée : republier la rend. Fiche non publiée : 409 PROFILE_NOT_PUBLISHED.' })
  @ApiOkResponse({ schema: STATE_SCHEMA })
  unpublish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the pipe is the point: it refuses any body
    @Body(new ZodValidationPipe(noBody)) _body: z.output<typeof noBody>,
  ): Promise<UnpublishPublicProfileResponse> {
    return this.unpublishProfile.handle({ actorId: user.id, agencyId });
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Lit l’état de la fiche pour tout membre actif : publiée ou non, adresse, visibilité, et ce qui la masque. Aucune donnée privée.' })
  @ApiOkResponse({ schema: STATE_SCHEMA })
  read(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agencyId', new ZodValidationPipe(uuidSchema)) agencyId: string,
  ): Promise<GetPublicProfileResponse> {
    return this.getProfile.handle({ agencyId, userId: user.id });
  }
}
