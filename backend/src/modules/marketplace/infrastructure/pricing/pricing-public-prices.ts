import { Injectable } from '@nestjs/common';
import { PublicPricingReader } from '@modules/pricing/application/queries/public-pricing/public-pricing.reader';
import { PublicPrices } from '../../application/ports/public-prices.port';

/** The adapter of the port: what `pricing` exposes (`PublicPricingReader`), and nothing else of that module. */
@Injectable()
export class PricingPublicPrices implements PublicPrices {
  constructor(private readonly reader: PublicPricingReader) {}

  startingPricesByZone(agencyId: string): Promise<ReadonlyMap<string, number>> {
    return this.reader.startingPricesByZone(agencyId);
  }
}
