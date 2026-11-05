import { Inject, Injectable } from '@nestjs/common';
import { READ_PUBLIC_PRICING_REPOSITORY, ReadPublicPricingRepository } from '../../ports/read-public-pricing.repository';

/**
 * What `pricing` exposes to the modules that build the public side of an agency (marketplace): the lowest price of each
 * zone, which is all a public "from" price is made of. Read only, and nothing of the tiers, the divisor, the versions
 * or the quotes; other modules never reach the tables behind it.
 */
@Injectable()
export class PublicPricingReader {
  constructor(@Inject(READ_PUBLIC_PRICING_REPOSITORY) private readonly prices: ReadPublicPricingRepository) {}

  startingPricesByZone(agencyId: string): Promise<ReadonlyMap<string, number>> {
    return this.prices.startingPricesByZone(agencyId);
  }
}
