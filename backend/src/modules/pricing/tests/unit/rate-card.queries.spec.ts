import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FixedClock, RecordingEventPublisher, SequentialIds, T0 } from '@shared/tests/doubles/fakes';
import { CreateRateCardHandler } from '../../application/commands/create-rate-card/create-rate-card.handler';
import { PublishRateCardVersionHandler } from '../../application/commands/publish-rate-card-version/publish-rate-card-version.handler';
import { GetRateCardHandler } from '../../application/queries/get-rate-card/get-rate-card.handler';
import { GetRateCardVersionHandler } from '../../application/queries/get-rate-card-version/get-rate-card-version.handler';
import { ListRateCardVersionsHandler } from '../../application/queries/list-rate-card-versions/list-rate-card-versions.handler';
import { ADMIN, AGENCY, AGENT, AKWA, AKWA_TIERS, BONABERI, FakeAgencyAccess, FORMER, InMemoryRateCardStore, OTHER_OWNER, OUTSIDER, OWNER, scale } from '../doubles/fakes';

const kindOf = (kind: string) => (error: unknown) => error instanceof Error && 'kind' in error && error.kind === kind;

async function setup(versions = 3) {
  const access = new FakeAgencyAccess();
  const store = new InMemoryRateCardStore();
  const clock = new FixedClock(T0);
  const events = new RecordingEventPublisher();
  await new CreateRateCardHandler(access, store, new SequentialIds(), clock, events).handle({ actorId: OWNER, agencyId: AGENCY, ...scale() });
  const publish = new PublishRateCardVersionHandler(access, store, clock, events);
  for (let number = 2; number <= versions; number++) {
    clock.advance(1000);
    await publish.handle({ actorId: ADMIN, agencyId: AGENCY, expectedVersion: number - 1, ...scale([{ zoneId: AKWA, tiers: [{ upTo: '1 kg', price: 1000 + number }, ...AKWA_TIERS.slice(1)] }]) });
  }
  return { access, store, get: new GetRateCardHandler(access, store), getVersion: new GetRateCardVersionHandler(access, store), list: new ListRateCardVersionsHandler(access, store) };
}

test('every active member reads the version in force, with the labels of the zones', async () => {
  const { get } = await setup();
  for (const user of [OWNER, ADMIN, AGENT]) {
    const card = await get.handle({ agencyId: AGENCY, userId: user });
    assert.equal(card.version.number, 3);
    assert.deepEqual(card.version.zones.map(zone => [zone.zoneId, zone.city, zone.district]), [[AKWA, 'Douala', 'Akwa']]);
    assert.equal(card.version.zones[0]?.tiers[0]?.price, 1003);
  }
});

test('a zone retired after the version keeps its tiers in it and is flagged retired', async () => {
  const { get, access } = await setup(1);
  access.deliveryState = async () => ({ deliveryActive: true, zones: [{ id: AKWA, city: 'Douala', district: 'Akwa', active: false }, { id: BONABERI, city: 'Douala', district: 'Bonabéri', active: true }] });
  const card = await get.handle({ agencyId: AGENCY, userId: AGENT });
  assert.deepEqual(card.version.zones.map(zone => [zone.zoneId, zone.zoneStatus, zone.tiers.length]), [[AKWA, 'retired', 4], [BONABERI, 'active', 1]]);
});

test('reading needs membership and a rate card: strangers and former members do not find the agency, and no rate card is not found', async () => {
  const { get, getVersion, list } = await setup();
  for (const user of [OUTSIDER, FORMER, OTHER_OWNER]) {
    await assert.rejects(get.handle({ agencyId: AGENCY, userId: user }), kindOf('not_found'));
    await assert.rejects(getVersion.handle({ agencyId: AGENCY, userId: user, number: 1 }), kindOf('not_found'));
    await assert.rejects(list.handle({ agencyId: AGENCY, userId: user, limit: 20, cursor: null }), kindOf('not_found'));
  }
  const empty = new GetRateCardHandler(new FakeAgencyAccess(), new InMemoryRateCardStore());
  await assert.rejects(empty.handle({ agencyId: AGENCY, userId: OWNER }), kindOf('not_found'));
});

test('an old version is read as it was written, an unknown number is not found', async () => {
  const { getVersion } = await setup();
  const first = await getVersion.handle({ agencyId: AGENCY, userId: AGENT, number: 1 });
  assert.equal(first.version.zones.length, 2);
  assert.equal(first.version.zones[0]?.tiers[0]?.price, 1000);
  assert.equal(first.version.createdBy, OWNER);
  assert.equal((await getVersion.handle({ agencyId: AGENCY, userId: AGENT, number: 2 })).version.zones[0]?.tiers[0]?.price, 1002);
  await assert.rejects(getVersion.handle({ agencyId: AGENCY, userId: AGENT, number: 4 }), kindOf('not_found'));
  await assert.rejects(getVersion.handle({ agencyId: AGENCY, userId: AGENT, number: 0 }), kindOf('not_found'));
});

test('the history lists the most recent first, with date, author and size, in pages', async () => {
  const { list } = await setup(5);
  const first = await list.handle({ agencyId: AGENCY, userId: AGENT, limit: 2, cursor: null });
  assert.deepEqual(first.items.map(item => item.number), [5, 4]);
  assert.deepEqual([first.hasMore, first.nextCursor], [true, '4']);
  assert.deepEqual(first.items[0], { number: 5, createdAt: new Date(T0.getTime() + 4000).toISOString(), createdBy: ADMIN, volumetricDivisor: null, zoneCount: 1 });
  const second = await list.handle({ agencyId: AGENCY, userId: AGENT, limit: 2, cursor: 4 });
  assert.deepEqual(second.items.map(item => item.number), [3, 2]);
  const last = await list.handle({ agencyId: AGENCY, userId: AGENT, limit: 2, cursor: 2 });
  assert.deepEqual([last.items.map(item => item.number), last.hasMore, last.nextCursor], [[1], false, null]);
  assert.equal(last.items[0]?.zoneCount, 2);
});
