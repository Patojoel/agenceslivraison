import { Module, OnModuleInit } from '@nestjs/common';
import { AgenciesModule } from '@modules/agencies/agencies.module';
import { IdentityModule } from '@modules/identity/identity.module';
import { PricingModule } from '@modules/pricing/pricing.module';
import { InProcessDomainEventPublisher } from '@shared/infrastructure/events/in-process-domain-event-publisher';
import { PublishPublicProfileHandler } from './application/commands/publish-public-profile/publish-public-profile.handler';
import { UnpublishPublicProfileHandler } from './application/commands/unpublish-public-profile/unpublish-public-profile.handler';
import { AGENCY_ACCESS } from './application/ports/agency-access.port';
import { PUBLIC_LISTING_WRITER } from './application/ports/public-listing.writer';
import { PUBLIC_PRICES } from './application/ports/public-prices.port';
import { READ_AGENCY_PUBLIC_PROFILE_REPOSITORY } from './application/ports/read-agency-public-profile.repository';
import { GetPublicProfileHandler } from './application/queries/get-public-profile/get-public-profile.handler';
import { MarketplaceAuditSubscriber } from './application/subscribers/marketplace-audit.subscriber';
import { PublicListingProjectionSubscriber } from './application/subscribers/public-listing-projection.subscriber';
import { AGENCY_PUBLIC_PROFILE_REPOSITORY } from './domain/ports/agency-public-profile.repository';
import { AgenciesAgencyAccess } from './infrastructure/agencies/agencies-agency-access';
import { AgencyPublicProfileTypeOrmRepository } from './infrastructure/persistence/typeorm/agency-public-profile.typeorm.repository';
import { PublicListingTypeOrmWriter } from './infrastructure/persistence/typeorm/public-listing.typeorm.writer';
import { ReadAgencyPublicProfileTypeOrmRepository } from './infrastructure/persistence/typeorm/read-agency-public-profile.typeorm.repository';
import { PricingPublicPrices } from './infrastructure/pricing/pricing-public-prices';
import { PublicProfileController } from './presentation/http/public-profile.controller';

/** Marketplace reaches `agencies` and `pricing` only through what they export (`AgencyAccessReader`, `PublicPricingReader`). */
@Module({
  imports: [IdentityModule, AgenciesModule, PricingModule],
  controllers: [PublicProfileController],
  providers: [
    { provide: AGENCY_ACCESS, useClass: AgenciesAgencyAccess },
    { provide: PUBLIC_PRICES, useClass: PricingPublicPrices },
    { provide: AGENCY_PUBLIC_PROFILE_REPOSITORY, useClass: AgencyPublicProfileTypeOrmRepository },
    { provide: READ_AGENCY_PUBLIC_PROFILE_REPOSITORY, useClass: ReadAgencyPublicProfileTypeOrmRepository },
    { provide: PUBLIC_LISTING_WRITER, useClass: PublicListingTypeOrmWriter },
    PublishPublicProfileHandler,
    UnpublishPublicProfileHandler,
    GetPublicProfileHandler,
    MarketplaceAuditSubscriber,
    PublicListingProjectionSubscriber,
  ],
})
export class MarketplaceModule implements OnModuleInit {
  constructor(
    private readonly publisher: InProcessDomainEventPublisher,
    private readonly audit: MarketplaceAuditSubscriber,
    private readonly projection: PublicListingProjectionSubscriber,
  ) {}

  onModuleInit(): void {
    this.publisher.subscribe(this.audit);
    this.publisher.subscribe(this.projection);
  }
}
