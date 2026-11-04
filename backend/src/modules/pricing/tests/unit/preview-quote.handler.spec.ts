import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FixedClock, RecordingEventPublisher, SequentialIds, T0 } from '@shared/tests/doubles/fakes';
import { CreateRateCardHandler } from '../../application/commands/create-rate-card/create-rate-card.handler';
import { PublishRateCardVersionHandler } from '../../application/commands/publish-rate-card-version/publish-rate-card-version.handler';
import { PreviewQuoteHandler } from '../../application/queries/preview-quote/preview-quote.handler';
import { PricingZoneRetired } from '../../domain/exceptions/pricing.exceptions';
import { ADMIN, AGENCY, AGENT, AKWA, AKWA_TIERS, BONABERI, DEIDO, FakeAgencyAccess, FOREIGN_ZONE, FORMER, InMemoryRateCardStore, OTHER_OWNER, OUTSIDER, OWNER, RETIRED_ZONE, scale } from '../doubles/fakes';

const kindOf = (kind: string) => (error: unknown) => error instanceof Error && 'kind' in error && error.kind === kind;
const parcel = (weight: string, dimensions: { length: number; width: number; height: number } | null = null) => ({ weight, dimensions });

async function setup(withCard = true, divisor: number | null = null) {
  const access = new FakeAgencyAccess();
  const store = new InMemoryRateCardStore();
  const events = new RecordingEventPublisher();
  const clock = new FixedClock(T0);
  if (withCard) await new CreateRateCardHandler(access, store, new SequentialIds(), clock, events).handle({ actorId: OWNER, agencyId: AGENCY, ...scale(undefined, divisor) });
  events.published.length = 0;
  return { access, store, events, clock, preview: new PreviewQuoteHandler(access, store) };
}
const ask = (zoneId: string, parcels: ReturnType<typeof parcel>[], userId = AGENT, agencyId = AGENCY) => ({ agencyId, userId, zoneId, parcels });

test('an agent simulates two parcels: prices, total, version and the indicative mention', async () => {
  const { preview } = await setup();
  assert.deepEqual(await preview.handle(ask(AKWA, [parcel('0,8 kg'), parcel('3 kg')])), {
    currency: 'XAF', indicative: true, notice: 'prix indicatif, non garanti sans devis', status: 'priced', version: 1, zoneId: AKWA,
    parcels: [{ taxableGrams: 800, price: 1000 }, { taxableGrams: 3000, price: 1500 }], total: 2500,
  });
});

test('a parcel out of the scale is signalled and there is no total', async () => {
  const { preview } = await setup();
  const result = await preview.handle(ask(AKWA, [parcel('2 kg'), parcel('31 kg')]));
  assert.deepEqual([result.status, result.total, result.parcels.map(item => item.price)], ['out_of_scale', null, [1500, null]]);
});

test('a zone without a line, and an agency without a rate card, have no tariff and no error', async () => {
  const { preview } = await setup();
  assert.deepEqual(await preview.handle(ask(DEIDO, [parcel('1 kg')])), { currency: 'XAF', indicative: true, notice: 'prix indicatif, non garanti sans devis', status: 'no_tariff', version: 1, zoneId: DEIDO, parcels: [], total: null });
  const empty = await setup(false);
  const result = await empty.preview.handle(ask(AKWA, [parcel('1 kg')]));
  assert.deepEqual([result.status, result.version, result.total], ['no_tariff', null, null]);
});

test('the volumetric weight of the version applies', async () => {
  const { preview } = await setup(true, 5000);
  const result = await preview.handle(ask(AKWA, [parcel('0,5 kg', { length: 30, width: 20, height: 10 })]));
  assert.deepEqual([result.parcels, result.total], [[{ taxableGrams: 1200, price: 1500 }], 1500]);
});

test('a retired zone cannot be priced; a zone unknown or of another agency is not found', async () => {
  const { preview } = await setup();
  await assert.rejects(preview.handle(ask(RETIRED_ZONE, [parcel('1 kg')])), PricingZoneRetired);
  await assert.rejects(preview.handle(ask(FOREIGN_ZONE, [parcel('1 kg')])), kindOf('not_found'));
});

test('the version in force at the time of the calculation is used', async () => {
  const { preview, access, store, clock, events } = await setup();
  await new PublishRateCardVersionHandler(access, store, clock, events).handle({ actorId: ADMIN, agencyId: AGENCY, expectedVersion: 1, ...scale([{ zoneId: AKWA, tiers: [{ upTo: '1 kg', price: 1200 }, ...AKWA_TIERS.slice(1)] }, { zoneId: BONABERI, tiers: [{ upTo: '1 kg', price: 1500 }] }]) });
  const result = await preview.handle(ask(AKWA, [parcel('1 kg')]));
  assert.deepEqual([result.version, result.total], [2, 1200]);
});

test('invalid inputs are refused as invalid, even when there is no rate card', async () => {
  for (const withCard of [true, false]) {
    const { preview } = await setup(withCard);
    for (const weight of ['2', '2 lb', '0 kg', '-1 kg', '1001 kg']) await assert.rejects(preview.handle(ask(AKWA, [parcel(weight)])), kindOf('invalid'), weight);
    await assert.rejects(preview.handle(ask(AKWA, [parcel('1 kg', { length: 30, width: 20, height: 0 })])), kindOf('invalid'));
    await assert.rejects(preview.handle(ask(AKWA, [])), kindOf('invalid'));
    await assert.rejects(preview.handle(ask(AKWA, Array.from({ length: 21 }, () => parcel('1 kg')))), kindOf('invalid'));
    assert.equal((await preview.handle(ask(AKWA, Array.from({ length: 20 }, () => parcel('1 kg'))))).parcels.length, withCard ? 20 : 0);
  }
});

test('only active members simulate; strangers, former members and other agencies are not found', async () => {
  const { preview } = await setup();
  for (const user of [OUTSIDER, FORMER, OTHER_OWNER]) await assert.rejects(preview.handle(ask(AKWA, [parcel('1 kg')], user)), kindOf('not_found'));
  assert.equal((await preview.handle(ask(AKWA, [parcel('1 kg')], OWNER))).status, 'priced');
});

test('a simulation writes nothing: no rate card, no version, no event, no lock', async () => {
  const { preview, store, events, access } = await setup();
  const state = [store.adds, store.saves, store.locks, access.sharedLocks];
  await preview.handle(ask(AKWA, [parcel('1 kg')]));
  assert.deepEqual([store.adds, store.saves, store.locks, access.sharedLocks, events.published.length], [...state, 0]);
});
