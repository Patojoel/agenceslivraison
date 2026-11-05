import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReadPublicPricingRepository } from '../../application/ports/read-public-pricing.repository';
import { PublicPricingReader } from '../../application/queries/public-pricing/public-pricing.reader';
import { AGENCY, AKWA, BONABERI } from '../doubles/fakes';

class FixedPrices implements ReadPublicPricingRepository {
  readonly asked: string[] = [];

  async startingPricesByZone(agencyId: string): Promise<ReadonlyMap<string, number>> {
    this.asked.push(agencyId);
    return new Map([[AKWA, 1000], [BONABERI, 1500]]);
  }
}

test('the reader gives the lowest price of each zone of the rate card in force, for the agency asked', async () => {
  const prices = new FixedPrices();
  const reader = new PublicPricingReader(prices);
  assert.deepEqual([...(await reader.startingPricesByZone(AGENCY))], [[AKWA, 1000], [BONABERI, 1500]]);
  assert.deepEqual(prices.asked, [AGENCY]);
});
