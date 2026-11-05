import { Module, OnModuleInit } from '@nestjs/common';
import { AgenciesModule } from '@modules/agencies/agencies.module';
import { IdentityModule } from '@modules/identity/identity.module';
import { InProcessDomainEventPublisher } from '@shared/infrastructure/events/in-process-domain-event-publisher';
import { AcceptQuoteHandler } from './application/commands/accept-quote/accept-quote.handler';
import { CreateRateCardHandler } from './application/commands/create-rate-card/create-rate-card.handler';
import { IssueQuoteHandler } from './application/commands/issue-quote/issue-quote.handler';
import { PublishRateCardVersionHandler } from './application/commands/publish-rate-card-version/publish-rate-card-version.handler';
import { AGENCY_ACCESS } from './application/ports/agency-access.port';
import { READ_QUOTE_REPOSITORY } from './application/ports/read-quote.repository';
import { READ_PUBLIC_PRICING_REPOSITORY } from './application/ports/read-public-pricing.repository';
import { READ_RATE_CARD_REPOSITORY } from './application/ports/read-rate-card.repository';
import { PublicPricingReader } from './application/queries/public-pricing/public-pricing.reader';
import { GetQuoteHandler } from './application/queries/get-quote/get-quote.handler';
import { GetRateCardVersionHandler } from './application/queries/get-rate-card-version/get-rate-card-version.handler';
import { GetRateCardHandler } from './application/queries/get-rate-card/get-rate-card.handler';
import { ListQuotesHandler } from './application/queries/list-quotes/list-quotes.handler';
import { ListRateCardVersionsHandler } from './application/queries/list-rate-card-versions/list-rate-card-versions.handler';
import { PreviewQuoteHandler } from './application/queries/preview-quote/preview-quote.handler';
import { PricingAuditSubscriber } from './application/subscribers/pricing-audit.subscriber';
import { QUOTE_REPOSITORY } from './domain/ports/quote.repository';
import { RATE_CARD_REPOSITORY } from './domain/ports/rate-card.repository';
import { AgenciesAgencyAccess } from './infrastructure/agencies/agencies-agency-access';
import { QuoteTypeOrmRepository } from './infrastructure/persistence/typeorm/quote.typeorm.repository';
import { RateCardTypeOrmRepository } from './infrastructure/persistence/typeorm/rate-card.typeorm.repository';
import { ReadQuoteTypeOrmRepository } from './infrastructure/persistence/typeorm/read-quote.typeorm.repository';
import { ReadPublicPricingTypeOrmRepository } from './infrastructure/persistence/typeorm/read-public-pricing.typeorm.repository';
import { ReadRateCardTypeOrmRepository } from './infrastructure/persistence/typeorm/read-rate-card.typeorm.repository';
import { QuoteController } from './presentation/http/quote.controller';
import { QuotePreviewController } from './presentation/http/quote-preview.controller';
import { RateCardController } from './presentation/http/rate-card.controller';

/** Pricing reaches the agencies only through `AgencyAccessReader`, which `AgenciesModule` exports. */
@Module({
  imports: [IdentityModule, AgenciesModule],
  controllers: [RateCardController, QuotePreviewController, QuoteController],
  providers: [
    { provide: AGENCY_ACCESS, useClass: AgenciesAgencyAccess },
    { provide: RATE_CARD_REPOSITORY, useClass: RateCardTypeOrmRepository },
    { provide: READ_RATE_CARD_REPOSITORY, useClass: ReadRateCardTypeOrmRepository },
    { provide: QUOTE_REPOSITORY, useClass: QuoteTypeOrmRepository },
    { provide: READ_QUOTE_REPOSITORY, useClass: ReadQuoteTypeOrmRepository },
    { provide: READ_PUBLIC_PRICING_REPOSITORY, useClass: ReadPublicPricingTypeOrmRepository },
    PublicPricingReader,
    CreateRateCardHandler,
    PublishRateCardVersionHandler,
    GetRateCardHandler,
    GetRateCardVersionHandler,
    ListRateCardVersionsHandler,
    PreviewQuoteHandler,
    IssueQuoteHandler,
    AcceptQuoteHandler,
    GetQuoteHandler,
    ListQuotesHandler,
    PricingAuditSubscriber,
  ],
  /** What other modules may read of the pricing of an agency; they never reach its tables, repositories or handlers. */
  exports: [PublicPricingReader],
})
export class PricingModule implements OnModuleInit {
  constructor(private readonly publisher: InProcessDomainEventPublisher, private readonly audit: PricingAuditSubscriber) {}

  onModuleInit(): void {
    this.publisher.subscribe(this.audit);
  }
}
