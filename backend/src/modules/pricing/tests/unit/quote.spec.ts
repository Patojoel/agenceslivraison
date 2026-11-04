import { test } from 'node:test';
import assert from 'node:assert/strict';
import { T0, uuid } from '@shared/tests/doubles/fakes';
import { UserId } from '@shared/domain/value-objects/user-id';
import { RateCard } from '../../domain/rate-card';
import { RateCardContent } from '../../domain/rate-card-content';
import { AgencyId } from '../../domain/value-objects/agency-id';
import { RateCardId } from '../../domain/value-objects/rate-card-id';

const AKWA = uuid(501);
const BONABERI = uuid(502);
const DEIDO = uuid(503);
const invalid = (error: unknown) => error instanceof Error && 'kind' in error && error.kind === 'invalid';
const tier = (upTo: string, price: number) => ({ upTo, price });

function card(divisor: number | null = null): RateCard {
  return RateCard.create({
    id: RateCardId.of(uuid(700)), agencyId: AgencyId.of(uuid(10)), authorId: UserId.of(uuid(2)), now: T0,
    zones: { statusOf: () => 'active' },
    content: RateCardContent.of(divisor, [
      { zoneId: AKWA, tiers: [tier('1 kg', 1000), tier('5 kg', 1500), tier('10 kg', 2500), tier('30 kg', 5000)] },
      { zoneId: BONABERI, tiers: [tier('1 kg', 1500)] },
    ]),
  });
}
const parcel = (weight: string, dimensions: { length: number; width: number; height: number } | null = null) => ({ weight, dimensions });

test('the bound of a tier is included', () => {
  const rows: [string, number][] = [['0,999 kg', 1000], ['1 kg', 1000], ['1000 g', 1000], ['1,001 kg', 1500], ['30 kg', 5000]];
  for (const [weight, price] of rows) {
    const result = card().quote(AKWA, [parcel(weight)]);
    assert.equal(result.status, 'priced', weight);
    assert.equal(result.status === 'priced' ? result.total : null, price, weight);
  }
});

test('a parcel over the last bound is out of the scale and there is no total', () => {
  const result = card().quote(AKWA, [parcel('2 kg'), parcel('31 kg')]);
  assert.equal(result.status, 'out_of_scale');
  assert.deepEqual(result.status === 'out_of_scale' ? result.parcels : null, [{ taxableGrams: 2000, price: 1500 }, { taxableGrams: 31_000, price: null }]);
  assert.equal('total' in result, false);
});

test('the total is the exact sum of the prices of the parcels', () => {
  const result = card().quote(AKWA, [parcel('0,8 kg'), parcel('3 kg')]);
  assert.deepEqual(result, { status: 'priced', parcels: [{ taxableGrams: 800, price: 1000 }, { taxableGrams: 3000, price: 1500 }], total: 2500 });
});

test('the volumetric weight applies when it exceeds the real weight', () => {
  const dims = { length: 30, width: 20, height: 10 };
  const light = card(5000).quote(AKWA, [parcel('0,5 kg', dims)]);
  assert.deepEqual(light, { status: 'priced', parcels: [{ taxableGrams: 1200, price: 1500 }], total: 1500 });
  const dense = card(5000).quote(AKWA, [parcel('2 kg', { length: 10, width: 10, height: 10 })]);
  assert.deepEqual(dense, { status: 'priced', parcels: [{ taxableGrams: 2000, price: 1500 }], total: 1500 });
});

test('without divisor, or without dimensions, only the real weight counts', () => {
  assert.equal(card(null).quote(AKWA, [parcel('0,5 kg', { length: 100, width: 100, height: 100 })]).status, 'priced');
  const noDimensions = card(5000).quote(AKWA, [parcel('0,5 kg')]);
  assert.deepEqual(noDimensions.status === 'priced' ? noDimensions.parcels : null, [{ taxableGrams: 500, price: 1000 }]);
});

test('the taxable weight is rounded up to the gram', () => {
  const tiny = card().quote(AKWA, [parcel('0,0004 kg')]);
  assert.deepEqual(tiny.status === 'priced' ? tiny.parcels : null, [{ taxableGrams: 1, price: 1000 }]);
  // 7 x 7 x 7 = 343 cm3 at 1 000 per kg is 343 g exactly; 5 x 5 x 5 at 3 000 is 41,666 g, rounded up to 42 g.
  const rounded = card(3000).quote(AKWA, [parcel('1 g', { length: 5, width: 5, height: 5 })]);
  assert.deepEqual(rounded.status === 'priced' ? rounded.parcels : null, [{ taxableGrams: 42, price: 1000 }]);
  const exact = card(1000).quote(AKWA, [parcel('1 g', { length: 7, width: 7, height: 7 })]);
  assert.deepEqual(exact.status === 'priced' ? exact.parcels : null, [{ taxableGrams: 343, price: 1000 }]);
});

test('a zone without a line has no tariff, without any error', () => {
  assert.deepEqual(card().quote(DEIDO, [parcel('1 kg')]), { status: 'no_tariff' });
});

test('the weight of a parcel needs its unit and bounds; dimensions are three whole numbers; 1 to 20 parcels', () => {
  for (const weight of ['2', '2 lb', '0 kg', '-1 kg', '1001 kg']) assert.throws(() => card().quote(AKWA, [parcel(weight)]), invalid, weight);
  assert.throws(() => card(5000).quote(AKWA, [parcel('1 kg', { length: 0, width: 2, height: 2 })]), invalid);
  assert.throws(() => card().quote(AKWA, []), invalid);
  assert.equal(card().quote(AKWA, Array.from({ length: 20 }, () => parcel('1 kg'))).status, 'priced');
  assert.throws(() => card().quote(AKWA, Array.from({ length: 21 }, () => parcel('1 kg'))), invalid);
});

test('the same inputs and the same version always give the same total', () => {
  const parcels = [parcel('0,8 kg'), parcel('3 kg', { length: 30, width: 20, height: 10 })];
  assert.deepEqual(card(5000).quote(AKWA, parcels), card(5000).quote(AKWA, parcels));
});
