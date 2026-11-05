import { Inject, Injectable } from '@nestjs/common';
import { AgencyEvent, isAgencyEvent } from '@modules/agencies/application/queries/agency-access/agency-events.contract';
import { isPricingEvent, PricingEvent } from '@modules/pricing/application/queries/public-pricing/pricing-events.contract';
import { DomainEventSubscriber } from '@shared/application/ports/domain-event-publisher.port';
import { DomainEvent } from '@shared/domain/domain-event';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { isMarketplaceEvent } from '../../domain/events/marketplace-events';
import { AGENCY_PUBLIC_PROFILE_REPOSITORY, AgencyPublicProfileRepository } from '../../domain/ports/agency-public-profile.repository';
import { composePublicListing } from '../../domain/public-listing';
import { AgencyId } from '../../domain/value-objects/agency-id';
import { AGENCY_ACCESS, AgencyAccess } from '../ports/agency-access.port';
import { PUBLIC_LISTING_WRITER, PublicListingWriter } from '../ports/public-listing.writer';
import { PUBLIC_PRICES, PublicPrices } from '../ports/public-prices.port';

/** What changes the name, the description, the capabilities, the zones or the cities of the sites of an agency. */
const AGENCY_EVENTS: ReadonlySet<AgencyEvent['type']> = new Set<AgencyEvent['type']>([
  'AgencyIdentityUpdated', 'AgencyProfileUpdated', 'AgencySubmittedForVerification',
  'ServiceZoneAdded', 'ServiceZoneRenamed', 'ServiceZoneRetired',
  'AgencySiteCreated', 'AgencySiteUpdated', 'AgencySiteDeactivated', 'AgencySiteReactivated',
  'AgencyCapabilityEnabled', 'AgencyCapabilitySuspended',
]);
/** What changes a starting price. */
const PRICING_EVENTS: ReadonlySet<PricingEvent['type']> = new Set<PricingEvent['type']>(['RateCardCreated', 'RateCardVersioned']);

function agencyOf(event: DomainEvent): string | null {
  if (isAgencyEvent(event) && AGENCY_EVENTS.has(event.type)) return event.agencyId;
  if (isPricingEvent(event) && PRICING_EVENTS.has(event.type)) return event.agencyId;
  if (isMarketplaceEvent(event)) return event.agencyId;
  return null;
}

/**
 * Keeps `public_agency_listings` in step with the agencies, in the transaction of the action that raised the event (the
 * compromise of plan B3: a failure here cancels the action). It rebuilds the row whole from what `agencies` and `pricing`
 * expose, so that it can run twice with the same result, and does nothing for an agency that never published a fiche.
 *
 * What keeps the row in step with what was committed:
 * - every action that raises one of these events holds a lock on the agency row, exclusive for `agencies`, shared for
 *   `pricing`; a publication or a withdrawal locks it against both (`FOR NO KEY UPDATE`, B3.17), so a first publication,
 *   whose profile row is not committed yet, never runs beside a rate card change that would not see it;
 * - the lock of the profile row is taken before anything is read: two rebuilds of one agency queue up, and the second one
 *   reads what the first one committed. Two `pricing` writes of one agency share the agency lock, and the last one to
 *   take the profile lock reads, and writes, the state in force.
 */
@Injectable()
export class PublicListingProjectionSubscriber implements DomainEventSubscriber {
  constructor(
    @Inject(AGENCY_ACCESS) private readonly access: AgencyAccess,
    @Inject(AGENCY_PUBLIC_PROFILE_REPOSITORY) private readonly profiles: AgencyPublicProfileRepository,
    @Inject(PUBLIC_PRICES) private readonly prices: PublicPrices,
    @Inject(PUBLIC_LISTING_WRITER) private readonly listings: PublicListingWriter,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    const agencyId = agencyOf(event);
    if (agencyId === null) return;
    const profile = await this.profiles.lockByAgency(AgencyId.of(agencyId));
    if (!profile) return;
    const view = await this.access.publicViewOf(agencyId);
    if (view === null) return;
    const startingPrices = await this.prices.startingPricesByZone(agencyId);
    await this.listings.upsert(composePublicListing(profile.snapshot(), view, startingPrices), this.clock.now());
  }
}
