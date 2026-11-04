import { Module, OnModuleInit } from '@nestjs/common';
import { AgenciesModule } from '@modules/agencies/agencies.module';
import { IdentityModule } from '@modules/identity/identity.module';
import { InProcessDomainEventPublisher } from '@shared/infrastructure/events/in-process-domain-event-publisher';
import { CreateRateCardHandler } from './application/commands/create-rate-card/create-rate-card.handler';
import { PublishRateCardVersionHandler } from './application/commands/publish-rate-card-version/publish-rate-card-version.handler';
import { AGENCY_ACCESS } from './application/ports/agency-access.port';
import { READ_RATE_CARD_REPOSITORY } from './application/ports/read-rate-card.repository';
import { GetRateCardVersionHandler } from './application/queries/get-rate-card-version/get-rate-card-version.handler';
import { GetRateCardHandler } from './application/queries/get-rate-card/get-rate-card.handler';
import { ListRateCardVersionsHandler } from './application/queries/list-rate-card-versions/list-rate-card-versions.handler';
import { PreviewQuoteHandler } from './application/queries/preview-quote/preview-quote.handler';
import { PricingAuditSubscriber } from './application/subscribers/pricing-audit.subscriber';
import { RATE_CARD_REPOSITORY } from './domain/ports/rate-card.repository';
import { AgenciesAgencyAccess } from './infrastructure/agencies/agencies-agency-access';
import { RateCardTypeOrmRepository } from './infrastructure/persistence/typeorm/rate-card.typeorm.repository';
import { ReadRateCardTypeOrmRepository } from './infrastructure/persistence/typeorm/read-rate-card.typeorm.repository';
import { QuotePreviewController } from './presentation/http/quote-preview.controller';
import { RateCardController } from './presentation/http/rate-card.controller';

/** Pricing reaches the agencies only through `AgencyAccessReader`, which `AgenciesModule` exports. */
@Module({
  imports: [IdentityModule, AgenciesModule],
  controllers: [RateCardController, QuotePreviewController],
  providers: [
    { provide: AGENCY_ACCESS, useClass: AgenciesAgencyAccess },
    { provide: RATE_CARD_REPOSITORY, useClass: RateCardTypeOrmRepository },
    { provide: READ_RATE_CARD_REPOSITORY, useClass: ReadRateCardTypeOrmRepository },
    CreateRateCardHandler,
    PublishRateCardVersionHandler,
    GetRateCardHandler,
    GetRateCardVersionHandler,
    ListRateCardVersionsHandler,
    PreviewQuoteHandler,
    PricingAuditSubscriber,
  ],
})
export class PricingModule implements OnModuleInit {
  constructor(private readonly publisher: InProcessDomainEventPublisher, private readonly audit: PricingAuditSubscriber) {}

  onModuleInit(): void {
    this.publisher.subscribe(this.audit);
  }
}
